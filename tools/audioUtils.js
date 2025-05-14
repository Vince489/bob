import fs from 'fs/promises';
import path from 'path';
import { createPartFromUri } from '@google/genai'; // GoogleGenAI instance will be passed from the tool

const MAX_INLINE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

const SUPPORTED_AUDIO_MIME_TYPES = {
  '.wav': 'audio/wav',
  '.mp3': 'audio/mp3',
  '.aiff': 'audio/aiff',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg', // OGG Vorbis
  '.flac': 'audio/flac',
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
 * Infers audio MIME type from file extension.
 * @param {string} filePathOrUrl - The file path or URL.
 * @returns {string|undefined} The inferred MIME type or undefined.
 */
function inferAudioMimeType(filePathOrUrl) {
  const ext = path.extname(filePathOrUrl).toLowerCase();
  return SUPPORTED_AUDIO_MIME_TYPES[ext];
}

/**
 * Fetches audio from a URL and returns its ArrayBuffer and inferred MIME type.
 * @param {string} url - The URL of the audio.
 * @returns {Promise<{buffer: ArrayBuffer, mimeType: string}>}
 */
async function fetchAudioFromUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch audio from URL: ${url}, status: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  const contentType = response.headers.get('content-type');
  // Prioritize actual content-type if it's an audio type, otherwise infer.
  const mimeType = contentType?.startsWith('audio/') ? contentType : inferAudioMimeType(url) || 'application/octet-stream';
  return { buffer, mimeType };
}

/**
 * Reads audio from a local file path and returns its Buffer and inferred MIME type.
 * @param {string} filePath - The local path to the audio file.
 * @returns {Promise<{buffer: Buffer, mimeType: string}>}
 */
async function readAudioFromLocalPath(filePath) {
  const buffer = await fs.readFile(filePath);
  const mimeType = inferAudioMimeType(filePath);
  if (!mimeType) {
    throw new Error(`Could not infer MIME type for local audio file: ${filePath}. Ensure it has a supported extension (${Object.keys(SUPPORTED_AUDIO_MIME_TYPES).join(', ')}).`);
  }
  return { buffer, mimeType };
}

/**
 * Prepares a single audio part for the Gemini API request.
 * Handles inline data for small files and uploads to File API for large files.
 * @param {string} source - URL or local file path of the audio.
 * @param {import('@google/genai').GoogleGenAI} genAI - The GoogleGenAI instance (passed from the tool using it).
 * @param {string} [forcedMimeType] - Optionally force a specific MIME type.
 * @returns {Promise<object>} The audio part for the Gemini API contents array.
 */
export async function prepareAudioPart(source, genAI, forcedMimeType) {
  let audioBuffer;
  let mimeType;
  let sourceIsUrl = isUrl(source);
  let displayName = sourceIsUrl ? path.basename(new URL(source).pathname) : path.basename(source);

  if (sourceIsUrl) {
    const { buffer, mimeType: fetchedMimeType } = await fetchAudioFromUrl(source);
    audioBuffer = buffer;
    mimeType = forcedMimeType || fetchedMimeType;
  } else {
    const { buffer, mimeType: inferredMimeType } = await readAudioFromLocalPath(source);
    audioBuffer = buffer;
    mimeType = forcedMimeType || inferredMimeType;
  }

  if (!Object.values(SUPPORTED_AUDIO_MIME_TYPES).includes(mimeType) && mimeType !== 'application/octet-stream') {
     console.warn(`MIME type ${mimeType} for ${source} may not be directly supported by Gemini for audio. Attempting to use it. Supported audio types are: ${Object.values(SUPPORTED_AUDIO_MIME_TYPES).join(', ')}`);
  }
   if (mimeType === 'application/octet-stream' && !forcedMimeType) {
    throw new Error(`Could not determine a specific audio MIME type for ${source}. Please ensure the URL provides an audio content-type header or the file has a supported extension, or use forcedMimeType.`);
  }

  const audioData = Buffer.from(audioBuffer); // Ensure it's a Buffer

  if (audioData.length < MAX_INLINE_SIZE_BYTES) {
    return {
      inlineData: {
        mimeType: mimeType,
        data: audioData.toString('base64'),
      },
    };
  } else {
    console.log(`Audio size (${(audioData.length / (1024*1024)).toFixed(2)}MB) exceeds ${MAX_INLINE_SIZE_BYTES / (1024*1024)}MB. Uploading via File API...`);
    
    const fileBlob = new Blob([audioData], { type: mimeType });

    const uploadResult = await genAI.files.upload({
      file: fileBlob,
      config: {
        displayName: displayName,
        mimeType: mimeType,
      },
    });
    console.log(`Uploaded audio file: ${uploadResult.name}, Display Name: ${displayName}`);

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
