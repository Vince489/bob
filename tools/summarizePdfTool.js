import { GeminiProvider } from '../providers/GeminiProvider.js';
import { preparePdfPart } from './pdfUtils.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Tool to summarize a PDF document using Gemini API.
 */
export class SummarizePdfTool {
  /**
   * @param {string} [apiKey] - Gemini API key. If not provided, attempts to load from .env.
   * @param {string} [modelName] - Gemini model name. Defaults to 'gemini-2.0-flash-lite'.
   */
  constructor(apiKey, modelName = 'gemini-2.0-flash-lite') {
    this.geminiProvider = new GeminiProvider(apiKey || process.env.GEMINI_API_KEY, modelName);
    this.name = 'summarizePdf';
    this.description = 'Summarizes the content of a PDF document from a given URL or local file path. Input should be an object with "source" (string: URL or path) and optional "prompt" (string: specific summarization instruction).';
    this.schema = {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'The URL or local file path of the PDF document to summarize.',
        },
        prompt: {
          type: 'string',
          description: 'Optional. A specific instruction for summarization (e.g., "Provide a one-paragraph summary focusing on the methodology"). Defaults to a general summarization prompt if not provided.',
        },
      },
      required: ['source'],
    };
  }

  /**
   * Runs the PDF summarization tool.
   * @param {object} args - The arguments for the tool.
   * @param {string} args.source - The URL or local file path of the PDF.
   * @param {string} [args.prompt] - Optional specific summarization instruction.
   * @returns {Promise<string>} A promise that resolves to the summary of the PDF.
   */
  async run({ source, prompt }) {
    if (!source) {
      throw new Error('Source (URL or local file path) for the PDF is required.');
    }

    try {
      console.log(`SummarizePdfTool: Preparing PDF part from source: ${source}`);
      const pdfPart = await preparePdfPart(source, this.geminiProvider.genAI);
      console.log('SummarizePdfTool: PDF part prepared.');

      const userPrompt = prompt || 'Summarize this document.';
      const contents = [
        { text: userPrompt },
        pdfPart,
      ];

      const geminiPrompt = {
        contents: contents,
        // Configuration for temperature, topP, etc., can be added here if needed
        // or rely on defaults in GeminiProvider.generateContent
      };

      console.log('SummarizePdfTool: Sending request to Gemini API...');
      const summary = await this.geminiProvider.generateContent(geminiPrompt);
      console.log('SummarizePdfTool: Summary received.');
      return summary;
    } catch (error) {
      console.error('Error in SummarizePdfTool:', error);
      throw new Error(`Failed to summarize PDF: ${error.message}`);
    }
  }
}

// Example usage (for testing purposes)
/*
async function testSummarizePdf() {
  // Ensure you have a .env file with GEMINI_API_KEY
  // or pass the key directly to the constructor.
  const tool = new SummarizePdfTool();

  // Test with a URL
  try {
    const urlSource = 'https://arxiv.org/pdf/2312.11805'; // Example PDF URL
    console.log(`\nTesting with URL: ${urlSource}`);
    const summaryUrl = await tool.run({ source: urlSource, prompt: "Summarize the abstract of this paper." });
    console.log('Summary (URL):', summaryUrl);
  } catch (error) {
    console.error('Error testing URL:', error.message);
  }

  // Test with a local file (create a dummy test.pdf or use an existing one)
  // try {
  //   const localSource = './test.pdf'; // Create a test.pdf in the root for this
  //   // await fs.writeFile(localSource, 'This is a test PDF content.'); // Simple text file for testing if no PDF available
  //   console.log(`\nTesting with local file: ${localSource}`);
  //   // Ensure test.pdf exists in the project root or adjust path
  //   const summaryLocal = await tool.run({ source: localSource });
  //   console.log('Summary (Local):', summaryLocal);
  // } catch (error) {
  //   console.error('Error testing local file:', error.message);
  // }
}

// testSummarizePdf();
*/
