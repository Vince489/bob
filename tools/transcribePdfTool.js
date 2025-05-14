import { GeminiProvider } from '../providers/GeminiProvider.js';
import { preparePdfPart } from './pdfUtils.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Tool to transcribe PDF document content to another format (e.g., HTML) using Gemini API.
 */
export class TranscribePdfTool {
  /**
   * @param {string} [apiKey] - Gemini API key. If not provided, attempts to load from .env.
   * @param {string} [modelName] - Gemini model name. Defaults to 'gemini-2.0-flash-lite'.
   */
  constructor(apiKey, modelName = 'gemini-2.0-flash-lite') {
    this.geminiProvider = new GeminiProvider(apiKey || process.env.GEMINI_API_KEY, modelName);
    this.name = 'transcribePdf';
    this.description = 'Transcribes the content of a PDF document from a URL or local file path into another format (defaults to HTML), preserving layout where possible. Input should be an object with "source" (string: URL or path), optional "targetFormat" (string, e.g., "HTML"), and optional "prompt" (string: specific transcription instructions).';
    this.schema = {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'The URL or local file path of the PDF document to transcribe.',
        },
        targetFormat: {
          type: 'string',
          description: 'Optional. The desired output format (e.g., "HTML", "Markdown"). Defaults to "HTML".',
        },
        prompt: {
          type: 'string',
          description: 'Optional. Specific instructions for transcription (e.g., "Transcribe only the first page to HTML").',
        },
      },
      required: ['source'],
    };
  }

  /**
   * Runs the PDF transcription tool.
   * @param {object} args - The arguments for the tool.
   * @param {string} args.source - The URL or local file path of the PDF.
   * @param {string} [args.targetFormat='HTML'] - The desired output format.
   * @param {string} [args.prompt] - Optional specific transcription instructions.
   * @returns {Promise<string>} A promise that resolves to the transcribed content.
   */
  async run({ source, targetFormat = 'HTML', prompt }) {
    if (!source) {
      throw new Error('Source (URL or local file path) for the PDF is required.');
    }

    try {
      console.log(`TranscribePdfTool: Preparing PDF part from source: ${source}`);
      const pdfPart = await preparePdfPart(source, this.geminiProvider.genAI);
      console.log('TranscribePdfTool: PDF part prepared.');

      let userPrompt = prompt || `Transcribe this document to ${targetFormat}. Preserve layout and formatting as much as possible.`;
      if (prompt && !prompt.toLowerCase().includes(targetFormat.toLowerCase())) {
        userPrompt = `${prompt} Transcribe to ${targetFormat}.`;
      }


      const contents = [
        { text: userPrompt },
        pdfPart,
      ];

      const geminiPrompt = {
        contents: contents,
      };

      console.log('TranscribePdfTool: Sending request to Gemini API...');
      const transcription = await this.geminiProvider.generateContent(geminiPrompt);
      console.log('TranscribePdfTool: Transcription received.');
      return transcription;
    } catch (error) {
      console.error('Error in TranscribePdfTool:', error);
      throw new Error(`Failed to transcribe PDF: ${error.message}`);
    }
  }
}

// Example usage (for testing purposes)
/*
async function testTranscribePdf() {
  const tool = new TranscribePdfTool();

  // Test with a URL
  try {
    const urlSource = 'https://arxiv.org/pdf/2312.11805'; // Example PDF URL
    console.log(`\nTesting transcription with URL: ${urlSource}`);
    const transcriptionHtml = await tool.run({ source: urlSource, targetFormat: 'HTML' });
    console.log('Transcription (HTML from URL):', transcriptionHtml.substring(0, 500) + '...'); // Log first 500 chars

    // const transcriptionMd = await tool.run({ source: urlSource, targetFormat: 'Markdown', prompt: "Transcribe the abstract to Markdown." });
    // console.log('Transcription (Markdown from URL):', transcriptionMd);

  } catch (error) {
    console.error('Error testing URL transcription:', error.message);
  }
}

// testTranscribePdf();
*/
