import {
  SummarizePdfTool,
  ExtractInfoFromPdfTool,
  TranscribePdfTool,
  ComparePdfsTool,
} from './tools/index.js';
import dotenv from 'dotenv';

// Ensure environment variables are loaded (especially GEMINI_API_KEY)
dotenv.config();

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set in the .env file. Please ensure it's configured.");
    return;
  }

  const mangoesPdfPath = './Mangoes.pdf';
  const orangesPdfPath = './Oranges.pdf';

  // --- Test SummarizePdfTool ---
  console.log('\n--- Testing SummarizePdfTool ---');
  const summarizeTool = new SummarizePdfTool();
  try {
    console.log(`Summarizing ${mangoesPdfPath}...`);
    const mangoSummary = await summarizeTool.run({ source: mangoesPdfPath });
    console.log(`Summary of ${mangoesPdfPath}:\n`, mangoSummary);
  } catch (error) {
    console.error(`Error summarizing ${mangoesPdfPath}:`, error.message);
  }

  // --- Test ExtractInfoFromPdfTool ---
  console.log('\n--- Testing ExtractInfoFromPdfTool ---');
  const extractTool = new ExtractInfoFromPdfTool();
  try {
    const orangesPrompt = "What are the main topics discussed in this document about oranges?";
    console.log(`Extracting info from ${orangesPdfPath} with prompt: "${orangesPrompt}"...`);
    const orangesInfo = await extractTool.run({ source: orangesPdfPath, prompt: orangesPrompt });
    console.log(`Information from ${orangesPdfPath}:\n`, orangesInfo);
  } catch (error) {
    console.error(`Error extracting info from ${orangesPdfPath}:`, error.message);
  }

  // --- Test TranscribePdfTool ---
  console.log('\n--- Testing TranscribePdfTool ---');
  const transcribeTool = new TranscribePdfTool();
  try {
    console.log(`Transcribing ${mangoesPdfPath} to HTML...`);
    const mangoHtmlTranscription = await transcribeTool.run({ source: mangoesPdfPath, targetFormat: 'HTML' });
    console.log(`HTML Transcription of ${mangoesPdfPath} (first 500 chars):\n`, mangoHtmlTranscription.substring(0, 500) + '...');
  } catch (error) {
    console.error(`Error transcribing ${mangoesPdfPath}:`, error.message);
  }

  // --- Test ComparePdfsTool ---
  console.log('\n--- Testing ComparePdfsTool ---');
  const compareTool = new ComparePdfsTool();
  try {
    const comparisonPrompt = "Compare the documents about Mangoes and Oranges. What are the key similarities and differences in their content? List the main topics for each.";
    console.log(`Comparing ${mangoesPdfPath} and ${orangesPdfPath} with prompt: "${comparisonPrompt}"...`);
    const comparisonResult = await compareTool.run({
      sources: [mangoesPdfPath, orangesPdfPath],
      prompt: comparisonPrompt,
    });
    console.log('Comparison Result:\n', comparisonResult);
  } catch (error) {
    console.error('Error comparing PDFs:', error.message);
  }

  console.log('\n--- PDF Tool Testing Complete ---');
}

main().catch(console.error);
