import { GeminiProvider } from '../providers/GeminiProvider.js';
import { prepareImagePart, prepareMultipleImageParts } from './imageUtils.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Tool to describe or answer questions about one or more images using Gemini API.
 */
export class DescribeImageTool {
  /**
   * @param {string} [apiKey] - Gemini API key. If not provided, attempts to load from .env.
   * @param {string} [modelName] - Gemini model name. Defaults to 'gemini-2.0-flash-lite'.
   */
  constructor(apiKey, modelName = 'gemini-2.0-flash-lite') {
    this.geminiProvider = new GeminiProvider(apiKey || process.env.GEMINI_API_KEY, modelName);
    this.name = 'describeImage';
    this.description = 'Generates a text description, caption, or answers questions about one or more images. Input should be an object with "sources" (string URL/path for one image, or array of strings for multiple) and "prompt" (string: e.g., "Describe this image.", "What is happening here?", "Compare these images.").';
    this.schema = {
      type: 'object',
      properties: {
        sources: {
          oneOf: [
            { type: 'string', description: 'URL or local file path of a single image.' },
            { type: 'array', items: { type: 'string' }, description: 'Array of URLs or local file paths for multiple images.' },
          ],
          description: 'The source(s) of the image(s). Can be a single URL/path or an array of URLs/paths.',
        },
        prompt: {
          type: 'string',
          description: 'The text prompt to guide the description or question (e.g., "Describe this image in detail.", "What are the key differences between these two pictures?").',
        },
      },
      required: ['sources', 'prompt'],
    };
  }

  /**
   * Runs the image description tool.
   * @param {object} args - The arguments for the tool.
   * @param {string|string[]} args.sources - URL/path of a single image or an array for multiple images.
   * @param {string} args.prompt - The text prompt.
   * @returns {Promise<string>} A promise that resolves to the generated text.
   */
  async run({ sources, prompt }) {
    if (!sources) {
      throw new Error('Image source(s) are required.');
    }
    if (!prompt) {
      throw new Error('A prompt is required.');
    }

    try {
      let imageParts = [];
      if (Array.isArray(sources)) {
        console.log(`DescribeImageTool: Preparing multiple image parts from sources: ${sources.join(', ')}`);
        imageParts = await prepareMultipleImageParts(sources, this.geminiProvider.genAI);
      } else if (typeof sources === 'string') {
        console.log(`DescribeImageTool: Preparing single image part from source: ${sources}`);
        const part = await prepareImagePart(sources, this.geminiProvider.genAI);
        imageParts.push(part);
      } else {
        throw new Error('Invalid "sources" format. Must be a string or an array of strings.');
      }
      console.log('DescribeImageTool: Image part(s) prepared.');

      const contents = [
        // As per best practices, text prompt often comes after image for single image,
        // but for multiple images or general queries, it can be flexible.
        // The Gemini examples show text first when multiple images are involved.
        { text: prompt },
        ...imageParts,
      ];
      
      // The Gemini SDK examples for JS show `createUserContent` for multiple parts,
      // but the underlying structure is an array of `Part` objects.
      // Let's ensure the structure matches what `generateContent` expects.
      // The `doc-understanding.txt` examples for PDF (which also use `generateContent`)
      // directly build the `contents` array like this.
      // The `image-understanding.txt` for JS `createUserContent` seems to be a helper
      // that ultimately produces a similar structure.
      // The `GeminiProvider` expects `prompt.contents`.

      const geminiPrompt = {
        contents: contents,
      };

      console.log('DescribeImageTool: Sending request to Gemini API...');
      const description = await this.geminiProvider.generateContent(geminiPrompt);
      console.log('DescribeImageTool: Description received.');
      return description;
    } catch (error) {
      console.error('Error in DescribeImageTool:', error);
      throw new Error(`Failed to describe image(s): ${error.message}`);
    }
  }
}

// Example usage (for testing purposes)
/*
async function testDescribeImage() {
  const tool = new DescribeImageTool();

  // Test with a single URL
  try {
    const imageUrl = 'https://storage.googleapis.com/generativeai-downloads/images/scones.jpg'; // Example image
    const promptText = "What is in this image?";
    console.log(`\nTesting with single URL: ${imageUrl}, Prompt: "${promptText}"`);
    const description = await tool.run({ sources: imageUrl, prompt: promptText });
    console.log('Description (single URL):', description);
  } catch (error) {
    console.error('Error testing single URL:', error.message);
  }

  // Test with multiple image URLs (if you have them)
  // try {
  //   const imageSources = [
  //     'https://storage.googleapis.com/generativeai-downloads/images/scones.jpg',
  //     'https://storage.googleapis.com/generativeai-downloads/images/croissant.jpg'
  //   ];
  //   const comparePrompt = "What are the differences between these two images?";
  //   console.log(`\nTesting with multiple URLs. Prompt: "${comparePrompt}"`);
  //   const comparison = await tool.run({ sources: imageSources, prompt: comparePrompt });
  //   console.log('Comparison (multiple URLs):', comparison);
  // } catch (error) {
  //   console.error('Error testing multiple URLs:', error.message);
  // }
}

// testDescribeImage();
*/
