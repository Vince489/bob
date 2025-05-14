import { GeminiProvider } from '../providers/GeminiProvider.js';
import { prepareAudioPart } from './audioUtils.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Tool to count tokens in an audio file using Gemini API.
 */
export class CountAudioTokensTool {
  /**
   * @param {string} [apiKey] - Gemini API key. If not provided, attempts to load from .env.
   * @param {string} [modelName] - Gemini model name. Defaults to 'gemini-2.0-flash-lite'.
   */
  constructor(apiKey, modelName = 'gemini-2.0-flash-lite') {
    if (!apiKey && !process.env.GEMINI_API_KEY) {
      throw new Error('API key is required. Please provide it as an argument or set it in .env.');
    }
    this.geminiProvider = new GeminiProvider(apiKey || process.env.GEMINI_API_KEY, modelName);
    this.name = 'countAudioTokens';
    this.description = 'Counts the number of tokens in an audio file as per Gemini model representation. Input should be an object with "source" (string: URL or path).';
    this.schema = {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'The URL or local file path of the audio file to count tokens for.',
        },
      },
      required: ['source'],
    };
  }

  /**
   * Runs the audio token counting tool.
   * @param {object} args - The arguments for the tool.
   * @param {string} args.source - URL or local file path of the audio.
   * @returns {Promise<{totalTokens: number}>} A promise that resolves to an object containing the total token count.
   */
  async run({ source }) {
    if (!source) {
      throw new Error('Audio source (URL or local file path) is required.');
    }

    try {
      console.log(`CountAudioTokensTool: Preparing audio part from source: ${source}`);
      // For countTokens, we only need the audio part, no text prompt.
      const audioPart = await prepareAudioPart(source, this.geminiProvider.genAI);
      console.log('CountAudioTokensTool: Audio part prepared.');
      
      // The `audio-understanding.txt` example for JS countTokens uses `createUserContent`
      // which wraps the parts array. The `ai.models.countTokens` expects a `contents` field.
      const contentsForTokenCount = [audioPart]; // Just the audio part

      console.log('CountAudioTokensTool: Sending request to Gemini API for token count...');
      const response = await this.geminiProvider.genAI.models.countTokens({
        model: this.geminiProvider.modelName, // Use modelName from the provider instance
        contents: contentsForTokenCount, // Pass the array of parts directly
      });
      
      console.log('CountAudioTokensTool: Token count received.');
      if (response && typeof response.totalTokens === 'number') {
        return { totalTokens: response.totalTokens };
      } else {
        console.error('CountAudioTokensTool: Invalid response structure for token count.', response);
        throw new Error('Failed to get totalTokens from API response.');
      }

    } catch (error) {
      console.error('Error in CountAudioTokensTool:', error);
      throw new Error(`Failed to count audio tokens: ${error.message}`);
    }
  }
}

// Example usage (for testing purposes)
/*
async function testCountAudioTokens() {
  const tool = new CountAudioTokensTool();
  const audioSourceUrl = 'https://storage.googleapis.com/generativeai-downloads/data/State_of_the_Union_Address_30_January_1961.mp3'; // Example

  try {
    console.log(`\nTesting token count for URL: ${audioSourceUrl}`);
    const tokenCountResult = await tool.run({ source: audioSourceUrl });
    console.log('Token Count Result (URL):', tokenCountResult);
  } catch (error) {
    console.error('Error testing token count with URL:', error.message);
  }
}

// testCountAudioTokens();
*/
