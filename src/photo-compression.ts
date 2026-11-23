/** Photo resize for the 500 KB field-evidence target.
 * Deliberately rejects unsupported formats rather than silently storing originals.
 * This does not provide cryptographic provenance or preserve EXIF metadata.
 */
export const PHOTO_TARGET_BYTES = 500 * 1024;
export const PHOTO_MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob && blob.type === 'image/jpeg') resolve(blob);
      else reject(new Error('JPEG compression is not available in this browser.'));
    }, 'image/jpeg', quality);
  });
}

async function readImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = url;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Image could not be decoded on this device.'));
    });
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (error) { URL.revokeObjectURL(url); throw error; }
}

export async function compressFieldPhoto(file: File): Promise<Blob> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error('Use a JPG, PNG or WebP image. This device cannot safely process the selected format.');
  }
  if (file.size === 0 || file.size > PHOTO_MAX_SOURCE_BYTES) {
    throw new Error('Photo must be between 1 byte and 12 MB.');
  }
  let source: Awaited<ReturnType<typeof readImage>>;
  try { source = await readImage(file); }
  catch { throw new Error('Photo could not be opened. Try taking another photo or selecting a JPG file.'); }
  try {
    if (source.width <= 0 || source.height <= 0 || source.width * source.height > 80_000_000) {
      throw new Error('Photo dimensions are not supported on this device.');
    }
    // First try 1600px. Reduce resolution progressively if needed.
    for (const maxDimension of [1600, 1280, 1024, 800]) {
      const scale = Math.min(1, maxDimension / Math.max(source.width, source.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(source.width * scale));
      canvas.height = Math.max(1, Math.round(source.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Image processing is not supported by this device.');
      // White background for transparent PNGs. Avoid transparency-to-black surprises.
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(source.source, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.70, 0.58, 0.46]) {
        const blob = await canvasToJpeg(canvas, quality);
        if (blob.size <= PHOTO_TARGET_BYTES) return blob;
      }
    }
    throw new Error('This image cannot fit within 500 KB. Please take a simpler photo.');
  } finally { source.close(); }
}
