import { GeminiProvider } from '../providers/GeminiProvider.js';
import { prepareAudioPart } from './audioUtils.js';
import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_TRANSCRIPTION_PROMPT = "Generate a transcript of the speech.";

/**
 * Tool to transcribe audio content using Gemini API.
 * Can transcribe specific segments if timestamps are in the prompt.
 */
export class TranscribeAudioTool {
  /**
   * @param {string} [apiKey] - Gemini API key. If not provided, attempts to load from .env.
   * @param {string} [modelName] - Gemini model name. Defaults to 'gemini-2.0-flash-lite'.
   */
  constructor(apiKey, modelName = 'gemini-2.0-flash-lite') {
    this.geminiProvider = new GeminiProvider(apiKey || process.env.GEMINI_API_KEY, modelName);
    this.name = 'transcribeAudio';
    this.description = 'Transcribes audio content from a URL or local file path. Can transcribe specific segments if timestamps (e.g., "from 01:20 to 02:30") are included in the prompt. Input should be an object with "source" (string: URL or path) and optional "prompt" (string).';
    this.schema = {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'The URL or local file path of the audio to transcribe.',
        },
        prompt: {
          type: 'string',
          description: `Optional. Specific instructions for transcription. Include timestamps like "from MM:SS to MM:SS" to transcribe a segment. Defaults to: "${DEFAULT_TRANSCRIPTION_PROMPT}"`,
        },
      },
      required: ['source'],
    };
  }

  /**
   * Runs the audio transcription tool.
   * @param {object} args - The arguments for the tool.
   * @param {string} args.source - URL or local file path of the audio.
   * @param {string} [args.prompt] - Optional transcription instructions, possibly with timestamps.
   * @returns {Promise<string>} A promise that resolves to the audio transcription.
   */
  async run({ source, prompt }) {
    if (!source) {
      throw new Error('Audio source (URL or local file path) is required.');
    }

    try {
      console.log(`TranscribeAudioTool: Preparing audio part from source: ${source}`);
      const audioPart = await prepareAudioPart(source, this.geminiProvider.genAI);
      console.log('TranscribeAudioTool: Audio part prepared.');

      const userPrompt = prompt || DEFAULT_TRANSCRIPTION_PROMPT;

      // For transcription, the audio part usually comes first, then the instruction.
      const contents = [
        audioPart,
        { text: userPrompt },
      ];
      
      // The `audio-understanding.txt` example for JS transcription uses `createUserContent`
      // which wraps the parts array. However, our GeminiProvider expects `contents` directly.
      // The structure `[{ audioPart }, { text: prompt }]` should be compatible.

      const geminiPrompt = {
        contents: contents,
      };

      console.log(`TranscribeAudioTool: Sending request to Gemini API with prompt: "${userPrompt}"`);
      const transcriptionResult = await this.geminiProvider.generateContent(geminiPrompt);
      console.log('TranscribeAudioTool: Transcription received.');
      return transcriptionResult;
    } catch (error) {
      console.error('Error in TranscribeAudioTool:', error);
      throw new Error(`Failed to transcribe audio: ${error.message}`);
    }
  }
}

// Example usage (for testing purposes)
/*
async function testTranscribeAudio() {
  const tool = new TranscribeAudioTool();
  const audioSourceUrl = 'https://storage.googleapis.com/generativeai-downloads/data/State_of_the_Union_Address_30_January_1961.mp3'; // Example

  // Test full transcription
  try {
    console.log(`\nTesting full transcription with URL: ${audioSourceUrl}`);
    const fullTranscript = await tool.run({ source: audioSourceUrl });
    console.log('Full Transcript (URL - first 500 chars):', fullTranscript.substring(0, 500) + "...");
  } catch (error) {
    console.error('Error testing full transcription with URL:', error.message);
  }

  // Test segmented transcription
  try {
    const segmentPrompt = "Provide a transcript of the speech from 00:30 to 00:45.";
    console.log(`\nTesting segmented transcription with URL: ${audioSourceUrl}, Prompt: "${segmentPrompt}"`);
    const segmentTranscript = await tool.run({ source: audioSourceUrl, prompt: segmentPrompt });
    console.log('Segment Transcript (URL):', segmentTranscript);
  } catch (error) {
    console.error('Error testing segmented transcription with URL:', error.message);
  }
}

// testTranscribeAudio();
*/
