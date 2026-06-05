import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../supabase';

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
    console.error('pickImages error:', e);
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
      const compressed = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      if (!compressed.base64) {
        throw new Error('Image manipulation failed.');
      }

      // Unique filename within user/entity path
      const path = `${userId}/${entityId}/${Date.now()}_${i}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(path, decode(compressed.base64), {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      uploadedPaths.push(path);
    } catch (error) {
      console.error(`uploadImages failure at index ${i}:`, error);

      // Rollback: Clean up any successfully uploaded images in this batch
      if (uploadedPaths.length > 0) {
        try {
          await supabase.storage.from(bucketName).remove(uploadedPaths);
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
  
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrls(paths, 31536000); // 1 year expiry

    if (error || !data) {
      console.error(`resolveSignedUrls error in ${bucketName}:`, error);
      return [];
    }

    return data.map(item => item.signedUrl).filter((url): url is string => !!url);
  } catch (e) {
    console.error(`resolveSignedUrls error in ${bucketName}:`, e);
    return [];
  }
}
