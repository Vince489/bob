import { GeminiProvider } from '../providers/GeminiProvider.js';
import { prepareMultiplePdfParts } from './pdfUtils.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Tool to compare multiple PDF documents using Gemini API.
 */
export class ComparePdfsTool {
  /**
   * @param {string} [apiKey] - Gemini API key. If not provided, attempts to load from .env.
   * @param {string} [modelName] - Gemini model name. Defaults to 'gemini-2.0-flash-lite'.
   */
  constructor(apiKey, modelName = 'gemini-2.0-flash-lite') {
    this.geminiProvider = new GeminiProvider(apiKey || process.env.GEMINI_API_KEY, modelName);
    this.name = 'comparePdfs';
    this.description = 'Compares multiple PDF documents based on a given prompt. Input should be an object with "sources" (array of strings: URLs or local file paths) and "prompt" (string: instruction for comparison, e.g., "Compare the key findings and output in a table.").';
    this.schema = {
      type: 'object',
      properties: {
        sources: {
          type: 'array',
          items: { type: 'string' },
          description: 'An array of URLs or local file paths for the PDF documents to compare.',
        },
        prompt: {
          type: 'string',
          description: 'A prompt guiding the comparison (e.g., "Compare the key findings of these papers and output them in a table.").',
        },
      },
      required: ['sources', 'prompt'],
    };
  }

  /**
   * Runs the PDF comparison tool.
   * @param {object} args - The arguments for the tool.
   * @param {string[]} args.sources - An array of URLs or local file paths for the PDFs.
   * @param {string} args.prompt - The prompt guiding the comparison.
   * @returns {Promise<string>} A promise that resolves to the comparison result.
   */
  async run({ sources, prompt }) {
    if (!sources || !Array.isArray(sources) || sources.length === 0) {
      throw new Error('Sources (array of URLs or local file paths) for the PDFs are required.');
    }
    if (sources.length < 2) {
      throw new Error('At least two PDF sources are required for comparison.');
    }
    if (!prompt) {
      throw new Error('Prompt (instruction for comparison) is required.');
    }

    try {
      console.log(`ComparePdfsTool: Preparing PDF parts from sources: ${sources.join(', ')}`);
      // Pass the genAI instance from the provider to pdfUtils
      const pdfParts = await prepareMultiplePdfParts(sources, this.geminiProvider.genAI);
      console.log('ComparePdfsTool: PDF parts prepared.');

      const contents = [
        { text: prompt },
        ...pdfParts, // Spread the array of PDF parts
      ];

      const geminiPrompt = {
        contents: contents,
      };

      console.log('ComparePdfsTool: Sending request to Gemini API...');
      const comparisonResult = await this.geminiProvider.generateContent(geminiPrompt);
      console.log('ComparePdfsTool: Comparison result received.');
      return comparisonResult;
    } catch (error) {
      console.error('Error in ComparePdfsTool:', error);
      throw new Error(`Failed to compare PDFs: ${error.message}`);
    }
  }
}

// Example usage (for testing purposes)
/*
async function testComparePdfs() {
  const tool = new ComparePdfsTool();

  try {
    const pdfSources = [
      'https://arxiv.org/pdf/2312.11805', // PDF 1 URL
      'https://arxiv.org/pdf/2403.05530'  // PDF 2 URL
    ];
    const comparisonPrompt = "What are the main differences in the methodologies proposed by these two papers? Output as a list.";

    console.log(`\nTesting PDF comparison with sources: ${pdfSources.join(', ')}`);
    console.log(`Comparison prompt: "${comparisonPrompt}"`);

    const result = await tool.run({ sources: pdfSources, prompt: comparisonPrompt });
    console.log('Comparison Result:', result);
  } catch (error) {
    console.error('Error testing PDF comparison:', error.message);
  }
}

// testComparePdfs();
*/
