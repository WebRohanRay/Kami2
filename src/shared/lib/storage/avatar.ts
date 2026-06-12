import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../supabase';
import { uploadManager } from './uploadManager';

type PickResult =
  | { success: true; uri: string }
  | { success: false; cancelled: true }
  | { success: false; cancelled: false; error: string };

type UploadResult =
  | { success: true; path: string }
  | { success: false; error: string };

export async function pickAvatarImage(): Promise<PickResult> {
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
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled) {
    return { success: false, cancelled: true };
  }

  const uri = result.assets[0]?.uri;

  if (!uri) {
    return {
      success: false,
      cancelled: false,
      error: 'Could not read the photo.',
    };
  }

  return { success: true, uri };
}

export async function uploadAvatar(
  userId: string,
  uri: string
): Promise<UploadResult> {
  try {
    // Fetch current profile to get old avatar path
    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .maybeSingle();

    const oldPath = profile?.avatar_url;

    // Use uploadManager to compress and upload
    const result = await uploadManager.compressAndUpload(uri, {
      bucket: 'avatars',
      userId,
      targetWidth: 400,
      thumbWidth: 150,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Delete old avatar and thumbnail from storage bucket if it was a storage file
    if (oldPath && !oldPath.startsWith('http')) {
      const oldThumbPath = oldPath.replace('.jpg', '_thumb.jpg');
      await supabase.storage.from('avatars').remove([oldPath, oldThumbPath]);
    }

    return {
      success: true,
      path: result.path,
    };
  } catch (error) {
    console.error('uploadAvatar error:', error);
    return {
      success: false,
      error: 'Something went wrong uploading your photo.',
    };
  }
}

export async function uploadHeroBg(
  userId: string,
  uri: string
): Promise<UploadResult> {
  try {
    const compressedOriginal = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );

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
      return {
        success: false,
        error: 'Could not process image.',
      };
    }

    // Fetch current profile to get old cover path
    const { data: profile } = await supabase
      .from('profiles')
      .select('hero_bg_url')
      .eq('id', userId)
      .maybeSingle();

    const oldPath = profile?.hero_bg_url;

    // Generate unique new path for cover image
    const path = `${userId}/hero_bg-${Date.now()}.jpg`;
    const thumbPath = path.replace('.jpg', '_thumb.jpg');

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, decode(compressedOriginal.base64), {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      return {
        success: false,
        error: 'Could not upload cover image.',
      };
    }

    const { error: uploadThumbError } = await supabase.storage
      .from('avatars')
      .upload(thumbPath, decode(compressedThumb.base64), {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadThumbError) {
      // Rollback original
      await supabase.storage.from('avatars').remove([path]);
      return {
        success: false,
        error: 'Could not upload cover image thumbnail.',
      };
    }

    // Delete old cover image and thumbnail from storage bucket if it was a storage file
    if (oldPath && !oldPath.startsWith('http')) {
      const oldThumbPath = oldPath.replace('.jpg', '_thumb.jpg');
      await supabase.storage.from('avatars').remove([oldPath, oldThumbPath]);
    }

    return {
      success: true,
      path,
    };
  } catch (error) {
    console.error('uploadHeroBg error:', error);
    return {
      success: false,
      error: 'Something went wrong uploading your cover image.',
    };
  }
}

export async function uploadCoupleHeroBg(
  coupleId: string,
  uri: string
): Promise<UploadResult> {
  try {
    const compressedOriginal = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );

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
      return {
        success: false,
        error: 'Could not process image.',
      };
    }

    // Fetch current couple to get old cover path
    const { data: couple } = await supabase
      .from('couples')
      .select('hero_bg_url')
      .eq('id', coupleId)
      .maybeSingle();

    const oldPath = couple?.hero_bg_url;

    // Generate unique new path for cover image
    const path = `${coupleId}/hero_bg-${Date.now()}.jpg`;
    const thumbPath = path.replace('.jpg', '_thumb.jpg');

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, decode(compressedOriginal.base64), {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      return {
        success: false,
        error: 'Could not upload cover image.',
      };
    }

    const { error: uploadThumbError } = await supabase.storage
      .from('avatars')
      .upload(thumbPath, decode(compressedThumb.base64), {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadThumbError) {
      // Rollback original
      await supabase.storage.from('avatars').remove([path]);
      return {
        success: false,
        error: 'Could not upload cover image thumbnail.',
      };
    }

    // Delete old cover image and thumbnail from storage bucket if it was a storage file
    if (oldPath && !oldPath.startsWith('http')) {
      const oldThumbPath = oldPath.replace('.jpg', '_thumb.jpg');
      await supabase.storage.from('avatars').remove([oldPath, oldThumbPath]);
    }

    return {
      success: true,
      path,
    };
  } catch (error) {
    console.error('uploadCoupleHeroBg error:', error);
    return {
      success: false,
      error: 'Something went wrong uploading your couple cover image.',
    };
  }
}