// ============================================================================
// StayNest Image & Camera Picker Adapter
// Opens Live Camera & Photo Gallery on Android/iOS, and File Input on Web
// ============================================================================

import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export const pickImageFromDevice = async (): Promise<string | null> => {
  if (Platform.OS === 'web') {
    return pickImageWeb();
  }

  return new Promise((resolve) => {
    Alert.alert(
      '📷 Add Bed Photo',
      'Choose an option to upload bed photo:',
      [
        {
          text: '📸 Take Photo (Camera)',
          onPress: async () => {
            try {
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Camera permission is required to capture bed photo.');
                resolve(null);
                return;
              }
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
              });
              if (!result.canceled && result.assets && result.assets.length > 0) {
                resolve(result.assets[0].uri);
              } else {
                resolve(null);
              }
            } catch (err: any) {
              console.log('Camera error:', err?.message);
              resolve(null);
            }
          },
        },
        {
          text: '🖼️ Choose from Gallery',
          onPress: async () => {
            try {
              const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Photo gallery permission is required.');
                resolve(null);
                return;
              }
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
              });
              if (!result.canceled && result.assets && result.assets.length > 0) {
                resolve(result.assets[0].uri);
              } else {
                resolve(null);
              }
            } catch (err: any) {
              console.log('Gallery error:', err?.message);
              resolve(null);
            }
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => resolve(null),
        },
      ]
    );
  });
};

const pickImageWeb = (): Promise<string | null> => {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        resolve((event.target?.result as string) || null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    input.click();
  });
};

export const pickMultipleImagesFromDevice = async (): Promise<string[]> => {
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      if (typeof document === 'undefined') {
        resolve([]);
        return;
      }
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.onchange = async (e: any) => {
        const files: File[] = Array.from(e.target?.files || []);
        if (!files.length) {
          resolve([]);
          return;
        }
        const readPromises = files.map(
          (file) =>
            new Promise<string>((res) => {
              const reader = new FileReader();
              reader.onload = (event) => res((event.target?.result as string) || '');
              reader.onerror = () => res('');
              reader.readAsDataURL(file);
            })
        );
        const results = await Promise.all(readPromises);
        resolve(results.filter((url) => Boolean(url)));
      };
      input.click();
    });
  }

  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return [];
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets) {
      return result.assets.map((a) => a.uri);
    }
    return [];
  } catch {
    return [];
  }
};
