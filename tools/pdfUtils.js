import fs from 'fs/promises';
import { GoogleGenAI, createPartFromUri } from '@google/genai';
import path from 'path';

const MAX_INLINE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

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
 * Fetches a PDF from a URL and returns its ArrayBuffer.
 * @param {string} url - The URL of the PDF.
 * @returns {Promise<ArrayBuffer>} The PDF content as an ArrayBuffer.
 */
async function fetchPdfFromUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF from URL: ${url}, status: ${response.status}`);
  }
  return await response.arrayBuffer();
}

/**
 * Reads a PDF from a local file path and returns its Buffer.
 * @param {string} filePath - The local path to the PDF file.
 * @returns {Promise<Buffer>} The PDF content as a Buffer.
 */
async function readPdfFromLocalPath(filePath) {
  return await fs.readFile(filePath);
}

/**
 * Prepares a PDF part for the Gemini API request.
 * Handles inline data for small files and uploads to File API for large files.
 * @param {string} source - URL or local file path of the PDF.
 * @param {GoogleGenAI} genAI - The GoogleGenAI instance.
 * @param {string} [displayName] - Optional display name for the file when using File API.
 * @returns {Promise<object>} The PDF part for the Gemini API contents array.
 *                          { inlineData: { mimeType: string, data: string } } OR
 *                          { fileData: { mimeType: string, fileUri: string } }
 */
export async function preparePdfPart(source, genAI, displayName) {
  let pdfBuffer;
  let sourceIsUrl = isUrl(source);

  if (sourceIsUrl) {
    pdfBuffer = await fetchPdfFromUrl(source);
  } else {
    pdfBuffer = await readPdfFromLocalPath(source);
  }

  const pdfData = Buffer.from(pdfBuffer); // Ensure it's a Buffer for size check and base64 conversion

  if (pdfData.length < MAX_INLINE_SIZE_BYTES) {
    // Use inlineData for smaller files
    return {
      inlineData: {
        mimeType: 'application/pdf',
        data: pdfData.toString('base64'),
      },
    };
  } else {
    // Use File API for larger files
    console.log(`PDF size (${(pdfData.length / (1024*1024)).toFixed(2)}MB) exceeds ${MAX_INLINE_SIZE_BYTES / (1024*1024)}MB. Uploading via File API...`);
    const effectiveDisplayName = displayName || (sourceIsUrl ? path.basename(new URL(source).pathname) : path.basename(source));

    const fileBlob = new Blob([pdfData], { type: 'application/pdf' });

    // The @google/genai SDK's uploadFile method expects a file path for Node.js,
    // or a File object/Blob in browser-like environments.
    // For Node.js, if we have a Buffer, we might need to write it to a temp file
    // or see if the SDK has evolved to directly take Buffers/Blobs.
    // The documentation examples show `ai.files.upload({ file: 'path-to-localfile.pdf', ... })`
    // or `ai.files.upload({ file: fileBlob, ... })` where fileBlob is a browser Blob.
    // Let's assume for now the SDK's `upload` can handle a Blob-like object or we adapt.
    // The provided doc examples use `ai.files.upload({ file: fileBlob, ...})` for URL-fetched large PDFs.

    const uploadResult = await genAI.files.upload({
      file: fileBlob, // This might need adjustment based on exact SDK behavior in Node.js for Blobs
      config: {
        displayName: effectiveDisplayName,
        mimeType: 'application/pdf',
      },
    });

    console.log(`Uploaded file: ${uploadResult.name}, Display Name: ${effectiveDisplayName}`);

    // Wait for the file to be processed
    let file = await genAI.files.get({ name: uploadResult.name });
    while (file.state === 'PROCESSING') {
      console.log(`File ${file.name} is still processing. Current state: ${file.state}. Retrying in 5 seconds...`);
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
    return createPartFromUri(file.uri, file.mimeType); // Uses fileData structure internally
  }
}

/**
 * Prepares multiple PDF parts for the Gemini API request.
 * @param {string[]} sources - Array of URLs or local file paths for the PDFs.
 * @param {GoogleGenAI} genAI - The GoogleGenAI instance.
 * @returns {Promise<object[]>} An array of PDF parts for the Gemini API contents array.
 */
export async function prepareMultiplePdfParts(sources, genAI) {
  const pdfParts = [];
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    const displayName = `PDF_${i + 1}_${isUrl(source) ? path.basename(new URL(source).pathname) : path.basename(source)}`;
    const part = await preparePdfPart(source, genAI, displayName);
    pdfParts.push(part);
  }
  return pdfParts;
}
