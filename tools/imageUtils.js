import fs from 'fs/promises';
import path from 'path';
import { createPartFromUri } from '@google/genai'; // GoogleGenAI will be from the provider

const MAX_INLINE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

const SUPPORTED_MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
};

/**
 * Determines if a source is a URL.
 * @param {string} source - The source string.
 * @returns {boolean} True if the source is a URL, false otherwise.
 */
function isUrl(source) {
  try {
    new URL(source);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Infers MIME type from file extension.
 * @param {string} filePathOrUrl - The file path or URL.
 * @returns {string|undefined} The inferred MIME type or undefined.
 */
function inferMimeType(filePathOrUrl) {
  const ext = path.extname(filePathOrUrl).toLowerCase();
  return SUPPORTED_MIME_TYPES[ext];
}

/**
 * Fetches an image from a URL and returns its ArrayBuffer and inferred MIME type.
 * @param {string} url - The URL of the image.
 * @returns {Promise<{buffer: ArrayBuffer, mimeType: string}>}
 */
async function fetchImageFromUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image from URL: ${url}, status: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  const contentType = response.headers.get('content-type');
  const mimeType = contentType?.startsWith('image/') ? contentType : inferMimeType(url) || 'application/octet-stream';
  return { buffer, mimeType };
}

/**
 * Reads an image from a local file path and returns its Buffer and inferred MIME type.
 * @param {string} filePath - The local path to the image file.
 * @returns {Promise<{buffer: Buffer, mimeType: string}>}
 */
async function readImageFromLocalPath(filePath) {
  const buffer = await fs.readFile(filePath);
  const mimeType = inferMimeType(filePath);
  if (!mimeType) {
    throw new Error(`Could not infer MIME type for local file: ${filePath}. Ensure it has a supported extension (${Object.keys(SUPPORTED_MIME_TYPES).join(', ')}).`);
  }
  return { buffer, mimeType };
}

/**
 * Prepares a single image part for the Gemini API request.
 * Handles inline data for small files and uploads to File API for large files.
 * @param {string} source - URL or local file path of the image.
 * @param {import('@google/genai').GoogleGenAI} genAI - The GoogleGenAI instance.
 * @param {string} [forcedMimeType] - Optionally force a specific MIME type.
 * @returns {Promise<object>} The image part for the Gemini API contents array.
 */
export async function prepareImagePart(source, genAI, forcedMimeType) {
  let imageBuffer;
  let mimeType;
  let sourceIsUrl = isUrl(source);
  let displayName = sourceIsUrl ? path.basename(new URL(source).pathname) : path.basename(source);

  if (sourceIsUrl) {
    const { buffer, mimeType: fetchedMimeType } = await fetchImageFromUrl(source);
    imageBuffer = buffer;
    mimeType = forcedMimeType || fetchedMimeType;
  } else {
    const { buffer, mimeType: inferredMimeType } = await readImageFromLocalPath(source);
    imageBuffer = buffer;
    mimeType = forcedMimeType || inferredMimeType;
  }

  if (!Object.values(SUPPORTED_MIME_TYPES).includes(mimeType) && mimeType !== 'application/octet-stream') {
     console.warn(`MIME type ${mimeType} for ${source} may not be directly supported by Gemini. Attempting to use it. Supported types are: ${Object.values(SUPPORTED_MIME_TYPES).join(', ')}`);
  }
   if (mimeType === 'application/octet-stream' && !forcedMimeType) {
    throw new Error(`Could not determine a specific image MIME type for ${source}. Please ensure the URL provides a content-type header or the file has a supported extension, or use forcedMimeType.`);
  }


  const imageData = Buffer.from(imageBuffer); // Ensure it's a Buffer

  if (imageData.length < MAX_INLINE_SIZE_BYTES) {
    return {
      inlineData: {
        mimeType: mimeType,
        data: imageData.toString('base64'),
      },
    };
  } else {
    console.log(`Image size (${(imageData.length / (1024*1024)).toFixed(2)}MB) exceeds ${MAX_INLINE_SIZE_BYTES / (1024*1024)}MB. Uploading via File API...`);
    
    const fileBlob = new Blob([imageData], { type: mimeType });

    const uploadResult = await genAI.files.upload({
      file: fileBlob,
      config: {
        displayName: displayName,
        mimeType: mimeType,
      },
    });
    console.log(`Uploaded file: ${uploadResult.name}, Display Name: ${displayName}`);

    let file = await genAI.files.get({ name: uploadResult.name });
    while (file.state === 'PROCESSING') {
      console.log(`File ${file.name} is still processing. State: ${file.state}. Retrying in 5 seconds...`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      file = await genAI.files.get({ name: uploadResult.name });
    }

    if (file.state === 'FAILED') {
      console.error(`File processing failed for ${file.name}:`, file);
      throw new Error(`File processing failed for ${file.name}. Reason: ${file.error?.message || 'Unknown error'}`);
    }
    if (file.state !== 'ACTIVE') {
        console.error(`File ${file.name} is not active. State: ${file.state}`);
        throw new Error(`File ${file.name} is not active after processing. State: ${file.state}`);
    }
    console.log(`File ${file.name} processed successfully. URI: ${file.uri}`);
    return createPartFromUri(file.uri, file.mimeType);
  }
}

/**
 * Prepares multiple image parts for the Gemini API request.
 * @param {string[]} sources - Array of URLs or local file paths for the images.
 * @param {import('@google/genai').GoogleGenAI} genAI - The GoogleGenAI instance.
 * @returns {Promise<object[]>} An array of image parts.
 */
export async function prepareMultipleImageParts(sources, genAI) {
  const imageParts = [];
  for (const source of sources) {
    // Note: forcedMimeType is not used here, relying on inference or URL headers.
    // If specific MIME types are needed per source, the calling tool should manage that.
    const part = await prepareImagePart(source, genAI);
    imageParts.push(part);
  }
  return imageParts;
}

/**
 * Denormalizes bounding box coordinates from the 0-1000 scale to original image pixel values.
 * @param {number[]} normalizedCoords - Array [ymin, xmin, ymax, xmax] with values in 0-1000 range.
 * @param {number} originalImageWidth - The width of the original image in pixels.
 * @param {number} originalImageHeight - The height of the original image in pixels.
 * @returns {number[]} Array [y_px_min, x_px_min, y_px_max, x_px_max] in pixel values.
 * @throws {Error} if inputs are invalid.
 */
export function denormalizeCoordinates(normalizedCoords, originalImageWidth, originalImageHeight) {
  if (!Array.isArray(normalizedCoords) || normalizedCoords.length !== 4) {
    throw new Error('normalizedCoords must be an array of 4 numbers [ymin, xmin, ymax, xmax].');
  }
  if (typeof originalImageWidth !== 'number' || originalImageWidth <= 0 ||
      typeof originalImageHeight !== 'number' || originalImageHeight <= 0) {
    throw new Error('originalImageWidth and originalImageHeight must be positive numbers.');
  }

  const [ymin, xmin, ymax, xmax] = normalizedCoords;

  return [
    Math.round((ymin / 1000) * originalImageHeight),
    Math.round((xmin / 1000) * originalImageWidth),
    Math.round((ymax / 1000) * originalImageHeight),
    Math.round((xmax / 1000) * originalImageWidth),
  ];
}
