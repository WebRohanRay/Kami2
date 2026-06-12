/**
 * signedUrlCache.ts
 *
 * In-memory cache for resolved Supabase storage signed URLs.
 * Bypasses network requests for recently generated signed URLs.
 * Signed URLs expire after 1 hour (3600 seconds). We consider a URL valid
 * if it has at least 5 minutes remaining before expiry.
 */

interface CacheEntry {
  signedUrl: string;
  expiresAt: number; // Unix timestamp in ms
}

const cache: Record<string, CacheEntry> = {};

function getKey(bucket: string, path: string): string {
  return `${bucket}:${path}`;
}

export const signedUrlCache = {
  /** Get a valid cached signed URL for a bucket and path */
  get(bucket: string, path: string): string | null {
    const key = getKey(bucket, path);
    const entry = cache[key];
    if (!entry) return null;

    // Check if the URL is still valid and has at least 5 minutes (300 seconds) remaining
    const isExpired = Date.now() >= (entry.expiresAt - 5 * 60 * 1000);
    if (isExpired) {
      delete cache[key];
      return null;
    }
    return entry.signedUrl;
  },

  /** Store a resolved signed URL in the cache */
  set(bucket: string, path: string, url: string, expiresAt: number): void {
    const key = getKey(bucket, path);
    cache[key] = {
      signedUrl: url,
      expiresAt,
    };
  },

  /** Retrieve a batch of paths from the cache */
  getBatch(
    bucket: string,
    paths: string[]
  ): { cached: Record<string, string>; missing: string[] } {
    const cached: Record<string, string> = {};
    const missing: string[] = [];

    for (const path of paths) {
      const url = this.get(bucket, path);
      if (url) {
        cached[path] = url;
      } else {
        missing.push(path);
      }
    }

    return { cached, missing };
  },
};
