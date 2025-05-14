import { GeminiProvider } from '../providers/GeminiProvider.js';
import { prepareImagePart } from './imageUtils.js'; // denormalizeCoordinates could be used by caller
import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_SEGMENTATION_PROMPT = `
Give the segmentation masks for all prominent objects in the image.
Output a JSON list of segmentation masks where each entry contains:
- "label" (string): A descriptive text label for the object.
- "box_2d" (array of 4 numbers): The 2D bounding box in [ymin, xmin, ymax, xmax] format, normalized to 0-1000.
- "mask" (string): The segmentation mask inside the bounding box, as a base64 encoded PNG (probability map with values 0-255).
Use descriptive labels.
`;

/**
 * Tool to segment objects in an image, providing bounding boxes, labels, and masks using Gemini API.
 */
export class SegmentObjectsInImageTool {
  /**
   * @param {string} [apiKey] - Gemini API key. If not provided, attempts to load from .env.
   * @param {string} [modelName] - Gemini model name. Defaults to 'gemini-2.0-flash-lite' (or a model supporting segmentation like Gemini 2.5).
   */
  constructor(apiKey, modelName = 'gemini-2.0-flash-lite') { // User might need to specify a segmentation-capable model
    this.geminiProvider = new GeminiProvider(apiKey || process.env.GEMINI_API_KEY, modelName);
    this.name = 'segmentObjectsInImage';
    this.description = 'Segments objects in an image, returning labels, bounding boxes (normalized 0-1000), and base64 encoded PNG segmentation masks. Input should be an object with "source" (string: URL or path) and "prompt" (string: specific segmentation instructions). Expects JSON output.';
    this.schema = {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'The URL or local file path of the image for object segmentation.',
        },
        prompt: {
          type: 'string',
          description: `Specific instructions for object segmentation. Defaults to: "${DEFAULT_SEGMENTATION_PROMPT.trim()}"`,
        },
      },
      required: ['source', 'prompt'], // Prompt is required as per image-understanding.txt example
    };
  }

  /**
   * Runs the object segmentation tool.
   * @param {object} args - The arguments for the tool.
   * @param {string} args.source - The URL or local file path of the image.
   * @param {string} args.prompt - Specific segmentation instructions.
   * @returns {Promise<Array<object>>} A promise that resolves to an array of segmented objects,
   *                                   each with 'label', 'box_2d' (normalized), and 'mask' (base64 PNG string).
   */
  async run({ source, prompt }) {
    if (!source) {
      throw new Error('Image source (URL or local file path) is required.');
    }
    if (!prompt) {
      // Default prompt is set in schema, but explicit check here for clarity
      // Or, we can make prompt optional and use default if not provided.
      // The doc example implies prompt is always given for segmentation.
      throw new Error('A prompt for segmentation instructions is required.');
    }

    try {
      console.log(`SegmentObjectsInImageTool: Preparing image part from source: ${source}`);
      const imagePart = await prepareImagePart(source, this.geminiProvider.genAI);
      console.log('SegmentObjectsInImageTool: Image part prepared.');

      const contents = [
        imagePart, // Image first
        { text: prompt },
      ];

      const geminiPrompt = {
        contents: contents,
      };

      console.log('SegmentObjectsInImageTool: Sending request to Gemini API...');
      const responseText = await this.geminiProvider.generateContent(geminiPrompt);
      console.log('SegmentObjectsInImageTool: Response received.');

      try {
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
        let parsableText = responseText;
        if (jsonMatch && jsonMatch[1]) {
          parsableText = jsonMatch[1];
        }
        
        const segmentedObjects = JSON.parse(parsableText);
        if (!Array.isArray(segmentedObjects)) {
          throw new Error('Segmented objects response is not a JSON array.');
        }
        // Further validation for 'label', 'box_2d', 'mask' keys could be added.
        return segmentedObjects;
      } catch (parseError) {
        console.error('Error parsing JSON response from Gemini for segmentation:', parseError);
        console.error('Raw response was:', responseText);
        throw new Error(`Failed to parse segmentation results as JSON. Raw response: ${responseText.substring(0,200)}...`);
      }

    } catch (error) {
      console.error('Error in SegmentObjectsInImageTool:', error);
      throw new Error(`Failed to segment objects in image: ${error.message}`);
    }
  }
}

// Example usage (for testing purposes)
/*
async function testSegmentObjects() {
  // Note: Segmentation might require specific Gemini models (e.g., Gemini 2.5 or later)
  // Ensure your GeminiProvider is configured with an appropriate model if the default 'gemini-2.0-flash-lite' doesn't support it well.
  const tool = new SegmentObjectsInImageTool(undefined, 'gemini-1.5-pro-latest'); // Or your preferred segmentation model
  
  const imageUrl = 'https://storage.googleapis.com/generativeai-downloads/images/scones.jpg'; // Example image
  const segmentationPrompt = `
    Give the segmentation masks for the scones and the plate.
    Output a JSON list of segmentation masks where each entry contains the 2D
    bounding box in the key "box_2d", the segmentation mask in key "mask", and
    the text label in the key "label". Use descriptive labels like "scone" or "plate".
  `;

  try {
    console.log(`\nTesting object segmentation with URL: ${imageUrl}`);
    const segments = await tool.run({ source: imageUrl, prompt: segmentationPrompt });
    console.log('Segmented Objects:', JSON.stringify(segments, null, 2));

    if (segments && segments.length > 0 && segments[0].mask) {
      console.log(`\nMask for the first object ("${segments[0].label}") is a base64 PNG string (first 60 chars): ${segments[0].mask.substring(0,60)}...`);
      // This mask would then be decoded from base64, and the PNG processed.
    }

  } catch (error) {
    console.error('Error testing object segmentation:', error.message);
  }
}

// testSegmentObjects();
*/
