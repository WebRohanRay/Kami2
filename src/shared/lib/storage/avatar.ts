import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../supabase';

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
    const compressed = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 400 } }],
      {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );

    if (!compressed.base64) {
      return {
        success: false,
        error: 'Could not process image.',
      };
    }

    // Fetch current profile to get old avatar path
    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .maybeSingle();

    const oldPath = profile?.avatar_url;

    // Generate unique new path to bypass image caching issues
    const path = `${userId}/avatar-${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, decode(compressed.base64), {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      return {
        success: false,
        error: 'Could not upload your photo.',
      };
    }

    // Delete old avatar from storage bucket if it was a storage file
    if (oldPath && !oldPath.startsWith('http')) {
      await supabase.storage.from('avatars').remove([oldPath]);
    }

    return {
      success: true,
      path,
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

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, decode(compressed.base64), {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      return {
        success: false,
        error: 'Could not upload cover image.',
      };
    }

    // Delete old cover image from storage bucket if it was a storage file
    if (oldPath && !oldPath.startsWith('http')) {
      await supabase.storage.from('avatars').remove([oldPath]);
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
    const path = `couple_${coupleId}/hero_bg-${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, decode(compressed.base64), {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      return {
        success: false,
        error: 'Could not upload cover image.',
      };
    }

    // Delete old cover image from storage bucket if it was a storage file
    if (oldPath && !oldPath.startsWith('http')) {
      await supabase.storage.from('avatars').remove([oldPath]);
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