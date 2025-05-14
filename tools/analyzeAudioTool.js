import { GeminiProvider } from '../providers/GeminiProvider.js';
import { prepareAudioPart } from './audioUtils.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Tool to analyze audio content (describe, summarize, answer questions) using Gemini API.
 */
export class AnalyzeAudioTool {
  /**
   * @param {string} [apiKey] - Gemini API key. If not provided, attempts to load from .env.
   * @param {string} [modelName] - Gemini model name. Defaults to 'gemini-2.0-flash-lite'.
   */
  constructor(apiKey, modelName = 'gemini-2.0-flash-lite') {
    this.geminiProvider = new GeminiProvider(apiKey || process.env.GEMINI_API_KEY, modelName);
    this.name = 'analyzeAudio';
    this.description = 'Analyzes audio content from a URL or local file path to provide descriptions, summaries, or answer questions. Input should be an object with "source" (string: URL or path) and "prompt" (string: e.g., "Describe this audio.", "Summarize this speech.").';
    this.schema = {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'The URL or local file path of the audio to analyze.',
        },
        prompt: {
          type: 'string',
          description: 'The text prompt to guide the analysis (e.g., "What is the primary topic of this audio?", "Summarize this meeting.").',
        },
      },
      required: ['source', 'prompt'],
    };
  }

  /**
   * Runs the audio analysis tool.
   * @param {object} args - The arguments for the tool.
   * @param {string} args.source - URL or local file path of the audio.
   * @param {string} args.prompt - The text prompt for analysis.
   * @returns {Promise<string>} A promise that resolves to the generated text analysis.
   */
  async run({ source, prompt }) {
    if (!source) {
      throw new Error('Audio source (URL or local file path) is required.');
    }
    if (!prompt) {
      throw new Error('A prompt for analysis is required.');
    }

    try {
      console.log(`AnalyzeAudioTool: Preparing audio part from source: ${source}`);
      const audioPart = await prepareAudioPart(source, this.geminiProvider.genAI);
      console.log('AnalyzeAudioTool: Audio part prepared.');

      // The order of parts (text then audio, or audio then text) can sometimes matter.
      // For general analysis, text prompt first is common.
      const contents = [
        { text: prompt },
        audioPart,
      ];

      const geminiPrompt = {
        contents: contents,
      };

      console.log('AnalyzeAudioTool: Sending request to Gemini API...');
      const analysisResult = await this.geminiProvider.generateContent(geminiPrompt);
      console.log('AnalyzeAudioTool: Analysis received.');
      return analysisResult;
    } catch (error) {
      console.error('Error in AnalyzeAudioTool:', error);
      throw new Error(`Failed to analyze audio: ${error.message}`);
    }
  }
}

// Example usage (for testing purposes)
/*
async function testAnalyzeAudio() {
  // Ensure you have a .env file with GEMINI_API_KEY
  const tool = new AnalyzeAudioTool();

  // Replace with an actual audio file URL or local path for testing
  const audioSourceUrl = 'https://storage.googleapis.com/generativeai-downloads/data/State_of_the_Union_Address_30_January_1961.mp3'; // Example
  // const localAudioPath = './test_audio.mp3'; // Create a test audio file

  try {
    const promptText = "Summarize the key points of this speech.";
    console.log(`\nTesting audio analysis with URL: ${audioSourceUrl}, Prompt: "${promptText}"`);
    const summary = await tool.run({ source: audioSourceUrl, prompt: promptText });
    console.log('Audio Summary (URL):', summary);
  } catch (error) {
    console.error('Error testing audio analysis with URL:', error.message);
  }

  // try {
  //   const localPrompt = "What is the overall tone of this audio piece?";
  //   console.log(`\nTesting audio analysis with local path: ${localAudioPath}, Prompt: "${localPrompt}"`);
  //   const tone = await tool.run({ source: localAudioPath, prompt: localPrompt });
  //   console.log('Audio Tone (Local):', tone);
  // } catch (error) {
  //   console.error('Error testing audio analysis with local file:', error.message);
  // }
}

// testAnalyzeAudio();
*/
