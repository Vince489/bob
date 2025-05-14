import { GeminiProvider } from '../providers/GeminiProvider.js';
import { prepareImagePart } from './imageUtils.js'; // Using denormalizeCoordinates is optional here, tool returns normalized
import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_OBJECT_DETECTION_PROMPT = "Detect all prominent objects in the image. For each object, provide its name and a 2D bounding box as [ymin, xmin, ymax, xmax] normalized to 0-1000. Output this as a JSON array, where each item has a 'label' (string) and 'box_2d' (array of 4 numbers).";

/**
 * Tool to detect objects in an image and return their bounding boxes using Gemini API.
 */
export class DetectObjectsInImageTool {
  /**
   * @param {string} [apiKey] - Gemini API key. If not provided, attempts to load from .env.
   * @param {string} [modelName] - Gemini model name. Defaults to 'gemini-2.0-flash-lite'.
   */
  constructor(apiKey, modelName = 'gemini-2.0-flash-lite') {
    this.geminiProvider = new GeminiProvider(apiKey || process.env.GEMINI_API_KEY, modelName);
    this.name = 'detectObjectsInImage';
    this.description = 'Detects objects in an image, returning their labels and bounding box coordinates (normalized to 0-1000). Input should be an object with "source" (string: URL or path) and optional "prompt" (string: specific detection instructions, defaults to general object detection). Expects JSON output from the model.';
    this.schema = {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'The URL or local file path of the image for object detection.',
        },
        prompt: {
          type: 'string',
          description: `Optional. Specific instructions for object detection. If not provided, defaults to: "${DEFAULT_OBJECT_DETECTION_PROMPT}"`,
        },
        // We might add originalImageWidth and originalImageHeight if we want the tool to denormalize
        // originalImageWidth: { type: 'number', description: 'Optional. Original width of the image in pixels for denormalizing coordinates.' },
        // originalImageHeight: { type: 'number', description: 'Optional. Original height of the image in pixels for denormalizing coordinates.' },
      },
      required: ['source'],
    };
  }

  /**
   * Runs the object detection tool.
   * @param {object} args - The arguments for the tool.
   * @param {string} args.source - The URL or local file path of the image.
   * @param {string} [args.prompt] - Optional specific detection instructions.
   * @returns {Promise<Array<object>>} A promise that resolves to an array of detected objects,
   *                                   each with 'label' and 'box_2d' (normalized).
   */
  async run({ source, prompt }) {
    if (!source) {
      throw new Error('Image source (URL or local file path) is required.');
    }

    try {
      console.log(`DetectObjectsInImageTool: Preparing image part from source: ${source}`);
      const imagePart = await prepareImagePart(source, this.geminiProvider.genAI);
      console.log('DetectObjectsInImageTool: Image part prepared.');

      const userPrompt = prompt || DEFAULT_OBJECT_DETECTION_PROMPT;

      const contents = [
        imagePart, // Image first, then prompt for this kind of task
        { text: userPrompt },
      ];

      const geminiPrompt = {
        contents: contents,
        // Potentially configure responseMimeType if API supports forcing JSON for this model/task
      };

      console.log('DetectObjectsInImageTool: Sending request to Gemini API...');
      const responseText = await this.geminiProvider.generateContent(geminiPrompt);
      console.log('DetectObjectsInImageTool: Response received.');

      // Attempt to parse the JSON response
      try {
        // The model might return plain text with JSON embedded, or just JSON.
        // A common pattern is for the JSON to be in a ```json ... ``` block.
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
        let parsableText = responseText;
        if (jsonMatch && jsonMatch[1]) {
          parsableText = jsonMatch[1];
        }
        
        const detectedObjects = JSON.parse(parsableText);
        if (!Array.isArray(detectedObjects)) {
          throw new Error('Detected objects response is not a JSON array.');
        }
        // Further validation could be added here to check item structure
        return detectedObjects;
      } catch (parseError) {
        console.error('Error parsing JSON response from Gemini for object detection:', parseError);
        console.error('Raw response was:', responseText);
        throw new Error(`Failed to parse object detection results as JSON. Raw response: ${responseText.substring(0,200)}...`);
      }

    } catch (error) {
      console.error('Error in DetectObjectsInImageTool:', error);
      throw new Error(`Failed to detect objects in image: ${error.message}`);
    }
  }
}

// Example usage (for testing purposes)
/*
import { denormalizeCoordinates } from './imageUtils.js';

async function testDetectObjects() {
  const tool = new DetectObjectsInImageTool();
  const imageUrl = 'https://storage.googleapis.com/generativeai-downloads/images/scones.jpg'; // Example image

  try {
    console.log(`\nTesting object detection with URL: ${imageUrl}`);
    const objects = await tool.run({ source: imageUrl });
    console.log('Detected Objects (Normalized):', JSON.stringify(objects, null, 2));

    // Example of denormalizing (assuming you know original image dimensions)
    // This would typically be done by the caller, or the tool could be extended
    // if original dimensions are passed in.
    // const originalWidth = 1920; // Replace with actual image width
    // const originalHeight = 1080; // Replace with actual image height
    // if (objects && objects.length > 0 && objects[0].box_2d) {
    //   const denormalized = denormalizeCoordinates(objects[0].box_2d, originalWidth, originalHeight);
    //   console.log(`Denormalized coords for first object (assuming ${originalWidth}x${originalHeight}):`, denormalized);
    // }

  } catch (error) {
    console.error('Error testing object detection:', error.message);
  }
}

// testDetectObjects();
*/
