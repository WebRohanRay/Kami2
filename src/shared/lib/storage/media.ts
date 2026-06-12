import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../supabase';
import { signedUrlCache } from './signedUrlCache';

type PickResult =
  | { success: true; uris: string[] }
  | { success: false; cancelled: true }
  | { success: false; cancelled: false; error: string };

type UploadResult =
  | { success: true; paths: string[] }
  | { success: false; error: string };

/** Pick one or multiple images from the photo library */
export async function pickImages(allowMultiple = true): Promise<PickResult> {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      return {
        success: false,
        cancelled: false,
        error: 'Photo library access was denied.',
      };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: allowMultiple,
      quality: 0.8,
    });

    if (result.canceled) {
      return { success: false, cancelled: true };
    }

    const uris = result.assets.map(asset => asset.uri).filter(Boolean);

    if (!uris.length) {
      return {
        success: false,
        cancelled: false,
        error: 'Could not read the photos.',
      };
    }

    return { success: true, uris };
  } catch (e) {
    return { success: false, cancelled: false, error: 'Failed to open library.' };
  }
}

/** Pick a single image with freeform cropping enabled */
export async function pickAndCropImage(): Promise<PickResult> {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      return {
        success: false,
        cancelled: false,
        error: 'Photo library access was denied.',
      };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, // Enable native cropping
      quality: 0.8,
    });

    if (result.canceled) {
      return { success: false, cancelled: true };
    }

    const uris = result.assets.map(asset => asset.uri).filter(Boolean);

    if (!uris.length) {
      return {
        success: false,
        cancelled: false,
        error: 'Could not read the photo.',
      };
    }

    return { success: true, uris };
  } catch (e) {
    console.error('pickAndCropImage error:', e);
    return { success: false, cancelled: false, error: 'Failed to open library.' };
  }
}

/** Upload multiple images with compression and partial cleanup on failure */
export async function uploadImages(
  bucketName: string,
  userId: string,
  entityId: string,
  uris: string[]
): Promise<UploadResult> {
  const uploadedPaths: string[] = [];

  for (let i = 0; i < uris.length; i++) {
    try {
      const uri = uris[i];

      // Compress to max width 1200px (also strips EXIF metadata automatically)
      const compressedOriginal = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      // Compress to max width 300px for thumbnail
      const compressedThumb = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 300 } }],
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      if (!compressedOriginal.base64 || !compressedThumb.base64) {
        throw new Error('Image manipulation failed.');
      }

      // Unique filename within user/entity path
      const timestamp = Date.now();
      const originalPath = `${userId}/${entityId}/${timestamp}_${i}.jpg`;
      const thumbPath = `${userId}/${entityId}/${timestamp}_${i}_thumb.jpg`;

      const { error: uploadErrorOriginal } = await supabase.storage
        .from(bucketName)
        .upload(originalPath, decode(compressedOriginal.base64), {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadErrorOriginal) {
        throw uploadErrorOriginal;
      }

      const { error: uploadErrorThumb } = await supabase.storage
        .from(bucketName)
        .upload(thumbPath, decode(compressedThumb.base64), {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadErrorThumb) {
        // Rollback original
        await supabase.storage.from(bucketName).remove([originalPath]);
        throw uploadErrorThumb;
      }

      uploadedPaths.push(originalPath);
    } catch (error) {
      console.error(`uploadImages failure at index ${i}:`, error);

      // Rollback: Clean up any successfully uploaded images in this batch
      if (uploadedPaths.length > 0) {
        try {
          const pathsToDelete = uploadedPaths.flatMap(p => [p, p.replace('.jpg', '_thumb.jpg')]);
          await supabase.storage.from(bucketName).remove(pathsToDelete);
        } catch (cleanupError) {
          console.error('Failed to roll back partial uploads:', cleanupError);
        }
      }

      return {
        success: false,
        error: 'Could not upload all photos. Upload cancelled.',
      };
    }
  }

  return {
    success: true,
    paths: uploadedPaths,
  };
}

/** Delete all images in the folder for a given entity */
export async function deleteImages(
  bucketName: string,
  userId: string,
  entityId: string
): Promise<void> {
  try {
    if (!userId?.trim() || userId.includes('..') || userId.includes('/') || userId.includes('\\')) {
      console.warn('deleteImages: Invalid or empty userId');
      return;
    }
    const folderPath = `${userId}/${entityId}`;

    // List all files in the directory
    const { data: files, error: listError } = await supabase.storage
      .from(bucketName)
      .list(folderPath);

    if (listError || !files || files.length === 0) {
      return;
    }

    const pathsToRemove = files.map(file => `${folderPath}/${file.name}`);

    // Remove the files
    const { error: removeError } = await supabase.storage
      .from(bucketName)
      .remove(pathsToRemove);

    if (removeError) {
      console.error(`deleteImages error in ${bucketName} for ${entityId}:`, removeError);
    }
  } catch (e) {
    console.error(`deleteImages error in ${bucketName} for ${entityId}:`, e);
  }
}

/** Resolve multiple storage paths to secure signed URLs */
export async function resolveSignedUrls(
  bucketName: string,
  paths: string[]
): Promise<string[]> {
  if (!paths || paths.length === 0) return [];
  
  let cached: Record<string, string> = {};
  try {
    const batch = signedUrlCache.getBatch(bucketName, paths);
    cached = batch.cached;
    const missing = batch.missing;
    
    if (missing.length === 0) {
      return paths.map(path => cached[path]).filter((url): url is string => !!url);
    }
    
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrls(missing, 3600); // 1 hour expiry

    if (error || !data) {
      console.error(`resolveSignedUrls error in ${bucketName}:`, error);
      return paths.map(path => cached[path]).filter((url): url is string => !!url);
    }

    const expiresAt = Date.now() + 3600 * 1000;
    data.forEach((item, idx) => {
      if (item.signedUrl) {
        const path = missing[idx];
        signedUrlCache.set(bucketName, path, item.signedUrl, expiresAt);
        cached[path] = item.signedUrl;
      }
    });

    return paths.map(path => cached[path]).filter((url): url is string => !!url);
  } catch (e) {
    console.error(`resolveSignedUrls error in ${bucketName}:`, e);
    return paths.map(path => cached[path]).filter((url): url is string => !!url);
  }
}
