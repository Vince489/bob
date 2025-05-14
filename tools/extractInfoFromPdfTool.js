import { GeminiProvider } from '../providers/GeminiProvider.js';
import { preparePdfPart } from './pdfUtils.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Tool to extract specific information or answer questions based on PDF content using Gemini API.
 */
export class ExtractInfoFromPdfTool {
  /**
   * @param {string} [apiKey] - Gemini API key. If not provided, attempts to load from .env.
   * @param {string} [modelName] - Gemini model name. Defaults to 'gemini-2.0-flash-lite'.
   */
  constructor(apiKey, modelName = 'gemini-2.0-flash-lite') {
    this.geminiProvider = new GeminiProvider(apiKey || process.env.GEMINI_API_KEY, modelName);
    this.name = 'extractInfoFromPdf';
    this.description = 'Extracts specific information or answers questions based on the content of a PDF document from a given URL or local file path. Input should be an object with "source" (string: URL or path) and "prompt" (string: the question or extraction instruction).';
    this.schema = {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'The URL or local file path of the PDF document.',
        },
        prompt: {
          type: 'string',
          description: 'A clear question or instruction for information extraction (e.g., "Extract all author names and affiliations", "What are the main conclusions of section 3?").',
        },
      },
      required: ['source', 'prompt'],
    };
  }

  /**
   * Runs the PDF information extraction tool.
   * @param {object} args - The arguments for the tool.
   * @param {string} args.source - The URL or local file path of the PDF.
   * @param {string} args.prompt - The question or extraction instruction.
   * @returns {Promise<string>} A promise that resolves to the extracted information or answer.
   */
  async run({ source, prompt }) {
    if (!source) {
      throw new Error('Source (URL or local file path) for the PDF is required.');
    }
    if (!prompt) {
      throw new Error('Prompt (question or extraction instruction) is required.');
    }

    try {
      console.log(`ExtractInfoFromPdfTool: Preparing PDF part from source: ${source}`);
      const pdfPart = await preparePdfPart(source, this.geminiProvider.genAI);
      console.log('ExtractInfoFromPdfTool: PDF part prepared.');

      const contents = [
        { text: prompt },
        pdfPart,
      ];

      const geminiPrompt = {
        contents: contents,
      };

      console.log('ExtractInfoFromPdfTool: Sending request to Gemini API...');
      const result = await this.geminiProvider.generateContent(geminiPrompt);
      console.log('ExtractInfoFromPdfTool: Information extracted.');
      return result;
    } catch (error) {
      console.error('Error in ExtractInfoFromPdfTool:', error);
      throw new Error(`Failed to extract information from PDF: ${error.message}`);
    }
  }
}

// Example usage (for testing purposes)
/*
async function testExtractInfoFromPdf() {
  const tool = new ExtractInfoFromPdfTool();

  // Test with a URL
  try {
    const urlSource = 'https://arxiv.org/pdf/2312.11805'; // Example PDF URL
    const question = "What is the title of this paper?";
    console.log(`\nTesting with URL: ${urlSource}, Question: "${question}"`);
    const answerUrl = await tool.run({ source: urlSource, prompt: question });
    console.log('Answer (URL):', answerUrl);
  } catch (error) {
    console.error('Error testing URL:', error.message);
  }

  // Test with another question
  try {
    const urlSource = 'https://arxiv.org/pdf/2312.11805'; // Example PDF URL
    const question = "List the authors of this paper.";
    console.log(`\nTesting with URL: ${urlSource}, Question: "${question}"`);
    const answerUrl = await tool.run({ source: urlSource, prompt: question });
    console.log('Answer (URL):', answerUrl);
  } catch (error) {
    console.error('Error testing URL:', error.message);
  }
}

// testExtractInfoFromPdf();
*/
