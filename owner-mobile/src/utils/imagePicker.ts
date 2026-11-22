/**
 * Helper to pick images from local machine or device camera in Web/React Native Web
 */

export const pickImageFromDevice = (): Promise<string | null> => {
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

export const pickMultipleImagesFromDevice = (): Promise<string[]> => {
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
};
