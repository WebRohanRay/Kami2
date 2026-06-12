import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../supabase';
import { uuid } from '../uuid';

export interface PickOptions {
  allowMultiple?: boolean;
  crop?: boolean;
  aspect?: [number, number];
}

export interface UploadOptions {
  bucket: string;
  userId: string;
  entityId?: string;
  targetWidth?: number;
  thumbWidth?: number;
}

export const uploadManager = {
  async pickImage(options: PickOptions = {}) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return { success: false as const, error: 'Photo library access was denied.', cancelled: false as const };
    }

    const pickerOptions: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: options.allowMultiple ?? false,
      allowsEditing: options.crop ?? false,
      quality: 0.8,
    };

    if (options.aspect) {
      pickerOptions.aspect = options.aspect;
    }

    const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
    if (result.canceled) {
      return { success: false as const, cancelled: true as const };
    }

    const uris = result.assets.map((asset) => asset.uri).filter(Boolean);
    if (uris.length === 0) {
      return { success: false as const, error: 'Could not read the photos.', cancelled: false as const };
    }

    return { success: true as const, uris };
  },

  async compressAndUpload(uri: string, options: UploadOptions) {
    const targetWidth = options.targetWidth ?? 1200;
    const thumbWidth = options.thumbWidth ?? 300;

    try {
      const compressedOriginal = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: targetWidth } }],
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      const compressedThumb = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: thumbWidth } }],
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      if (!compressedOriginal.base64 || !compressedThumb.base64) {
        return { success: false as const, error: 'Could not process image.' };
      }

      const pathPrefix = options.entityId ? `${options.userId}/${options.entityId}` : options.userId;
      const uniqueId = `${Date.now()}_${uuid().substring(0, 8)}`;
      const path = `${pathPrefix}/img-${uniqueId}.jpg`;
      const thumbPath = path.replace('.jpg', '_thumb.jpg');

      const { error: uploadError } = await supabase.storage
        .from(options.bucket)
        .upload(path, decode(compressedOriginal.base64), {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        return { success: false as const, error: 'Could not upload your photo.' };
      }

      const { error: uploadThumbError } = await supabase.storage
        .from(options.bucket)
        .upload(thumbPath, decode(compressedThumb.base64), {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadThumbError) {
        await supabase.storage.from(options.bucket).remove([path]);
        return { success: false as const, error: 'Could not upload thumbnail.' };
      }

      return { success: true as const, path, thumbPath };
    } catch (e) {
      return { success: false as const, error: e instanceof Error ? e.message : 'Upload failed.' };
    }
  },
};
