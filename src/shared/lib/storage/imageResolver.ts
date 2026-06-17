import { Paths, File, Directory } from 'expo-file-system';
import { db } from '@shared/db/client';
import * as schema from '@shared/db/schema';
import { eq, and } from 'drizzle-orm';
import { resolveSignedUrls } from './media';
import { signedUrlCache } from './signedUrlCache';
import { uuid } from '../uuid';

const UPLOADS_DIR = `${Paths.document.uri}uploads/`;

function ensureAbsoluteUri(uri: string): string {
  if (!uri) return '';
  if (uri.includes('://')) {
    return uri;
  }
  if (uri.startsWith('/')) {
    return `file://${uri}`;
  }
  return `file://${uri}`;
}

export interface ImageResolveResult {
  uri: string | null;
  status: 'local' | 'remote' | 'unavailable';
}

/**
 * Resolves a single image reference to a displayable URI (local first, falling back to Supabase remote).
 */
export async function resolveImageUri(imageRef: string | null | undefined, bucketName: string): Promise<ImageResolveResult> {
  if (!imageRef) {
    return { uri: null, status: 'unavailable' };
  }

  // 1. If it starts with http, it is already fully resolved
  if (imageRef.startsWith('http')) {
    return { uri: imageRef, status: 'remote' };
  }

  // 2. If it is a local file URI or raw path
  if (imageRef.startsWith('file://') || imageRef.startsWith('/')) {
    const absUri = ensureAbsoluteUri(imageRef);
    const file = new File(absUri);
    if (file.exists) {
      return { uri: absUri, status: 'local' };
    }

    // If local file is missing, try to find a remote path in image_records
    try {
      const records = await db
        .select()
        .from(schema.imageRecords)
        .where(eq(schema.imageRecords.localUri, absUri))
        .limit(1);

      if (records.length > 0 && records[0].supabasePath) {
        // Recurse to resolve the Supabase path
        return resolveImageUri(records[0].supabasePath, records[0].bucketName || bucketName);
      }
    } catch (err) {
      console.warn('[ImageResolver] Error looking up localUri in database:', err);
    }

    return { uri: null, status: 'unavailable' };
  }

  // 3. Otherwise, treat it as a Supabase relative storage path
  // First, check if there is an image_record pointing to a valid local file
  try {
    const records = await db
      .select()
      .from(schema.imageRecords)
      .where(eq(schema.imageRecords.supabasePath, imageRef))
      .limit(1);

    if (records.length > 0 && records[0].localUri) {
      const localAbs = ensureAbsoluteUri(records[0].localUri);
      if (new File(localAbs).exists) {
        return { uri: localAbs, status: 'local' };
      }
    }
  } catch (err) {
    console.warn('[ImageResolver] Error looking up supabasePath in database:', err);
  }

  // Next, check in-memory cache
  const cachedUrl = signedUrlCache.get(bucketName, imageRef);
  if (cachedUrl) {
    return { uri: cachedUrl, status: 'remote' };
  }

  // Finally, generate signed URL
  try {
    const urls = await resolveSignedUrls(bucketName, [imageRef]);
    if (urls.length > 0 && urls[0]) {
      return { uri: urls[0], status: 'remote' };
    }
  } catch (err) {
    console.error('[ImageResolver] Failed to resolve signed URL:', err);
  }

  return { uri: null, status: 'unavailable' };
}

/**
 * Resolves a batch of image references to displayable URIs.
 */
export async function resolveImageBatch(refs: string[], bucketName: string): Promise<Record<string, ImageResolveResult>> {
  const results: Record<string, ImageResolveResult> = {};
  const missingRefs: string[] = [];

  for (const ref of refs) {
    if (!ref) {
      results[ref] = { uri: null, status: 'unavailable' };
      continue;
    }
    if (ref.startsWith('http')) {
      results[ref] = { uri: ref, status: 'remote' };
      continue;
    }
    if (ref.startsWith('file://') || ref.startsWith('/')) {
      const absUri = ensureAbsoluteUri(ref);
      if (new File(absUri).exists) {
        results[ref] = { uri: absUri, status: 'local' };
      } else {
        // We'll resolve missing local files one-by-one (rare case)
        results[ref] = await resolveImageUri(ref, bucketName);
      }
      continue;
    }

    // Storage path: check if local record exists
    try {
      const records = await db
        .select()
        .from(schema.imageRecords)
        .where(eq(schema.imageRecords.supabasePath, ref))
        .limit(1);

      if (records.length > 0 && records[0].localUri && new File(ensureAbsoluteUri(records[0].localUri)).exists) {
        results[ref] = { uri: ensureAbsoluteUri(records[0].localUri), status: 'local' };
        continue;
      }
    } catch (err) {
      // Ignored
    }

    // Check signed URL cache
    const cachedUrl = signedUrlCache.get(bucketName, ref);
    if (cachedUrl) {
      results[ref] = { uri: cachedUrl, status: 'remote' };
    } else {
      missingRefs.push(ref);
    }
  }

  if (missingRefs.length > 0) {
    try {
      const signedUrls = await resolveSignedUrls(bucketName, missingRefs);
      missingRefs.forEach((ref, idx) => {
        const url = signedUrls[idx];
        if (url) {
          results[ref] = { uri: url, status: 'remote' };
        } else {
          results[ref] = { uri: null, status: 'unavailable' };
        }
      });
    } catch (err) {
      console.error('[ImageResolver] Failed to resolve batch signed URLs:', err);
      missingRefs.forEach((ref) => {
        results[ref] = { uri: null, status: 'unavailable' };
      });
    }
  }

  return results;
}

/**
 * Downloads a remote image from Supabase and stores it in the local uploads directory.
 */
export async function downloadAndCacheImage(supabasePath: string, bucketName: string): Promise<string | null> {
  try {
    // 1. Get signed URL
    const urls = await resolveSignedUrls(bucketName, [supabasePath]);
    if (urls.length === 0 || !urls[0]) {
      return null;
    }
    const signedUrl = urls[0];

    // 2. Ensure destination folder exists
    const uploadsDir = new Directory(ensureAbsoluteUri(UPLOADS_DIR));
    if (!uploadsDir.exists) {
      uploadsDir.create({ intermediates: true, idempotent: true });
    }

    // 3. Name file
    const cleanFilename = supabasePath.split('/').pop() || `${uuid()}.jpg`;
    const permanentUri = `${UPLOADS_DIR}cached_${cleanFilename}`;
    const fileDest = new File(ensureAbsoluteUri(permanentUri));

    // 4. Download file
    await File.downloadFileAsync(signedUrl, fileDest, { idempotent: true });

    // 5. Save/Update record in database
    const now = new Date().toISOString();
    const existing = await db
      .select()
      .from(schema.imageRecords)
      .where(eq(schema.imageRecords.supabasePath, supabasePath))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.imageRecords)
        .set({
          localUri: permanentUri,
          syncStatus: 'synced',
          lastSyncedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.imageRecords.id, existing[0].id));
    } else {
      await db.insert(schema.imageRecords).values({
        id: uuid(),
        entityType: 'cache',
        entityId: 'cache',
        localUri: permanentUri,
        supabasePath,
        bucketName,
        syncStatus: 'synced',
        lastSyncedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    return permanentUri;
  } catch (err) {
    console.error('[ImageResolver] Failed to download and cache image:', err);
    return null;
  }
}
