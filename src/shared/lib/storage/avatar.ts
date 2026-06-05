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

    const path = `${userId}/avatar.jpg`;

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