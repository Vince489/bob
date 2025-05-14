import { GoogleGenAI } from '@google/genai';
import readline from 'readline';
import fs from 'fs/promises';

/**
 * GeminiProvider class for generating content using Google's Gemini API
 */
export class GeminiProvider {
  /**
   * Create a new Gemini provider
   * @param {string} apiKey - Gemini API key
   * @param {string} modelName - Model name to use (default: 'gemini-2.0-flash-lite')
   */
  constructor(apiKey, modelName = 'gemini-2.0-flash-lite') {
    if (!apiKey) {
      console.error('Error: GEMINI_API_KEY environment variable is not set.');
      console.error('Create a .env file with your API key or export it manually.');
      process.exit(1); 
    }
    
    this.genAI = new GoogleGenAI({ apiKey });
    this.modelName = modelName;
  }

  /**
   * Handle missing API key by prompting the user
   * @returns {Promise<string>} - The API key
   */
  async handleMissingApiKey() {
    console.error('Error: GEMINI_API_KEY environment variable is not set.');
    
    // Create readline interface
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    // Prompt for API key
    const apiKey = await new Promise((resolve) => {
      rl.question('Please enter your Gemini API key: ', async (key) => {
        rl.close();
        if (key && key.trim()) {
          // Save to .env file for future use
          try {
            // Check if .env exists
            try {
              await fs.access('.env');
              // Append to existing file
              await fs.appendFile('.env', `\nGEMINI_API_KEY=${key.trim()}`);
            } catch {
              // Create new file
              await fs.writeFile('.env', `GEMINI_API_KEY=${key.trim()}`);
            }
            console.log('API key saved to .env file for future use.');
            process.env.GEMINI_API_KEY = key.trim(); // Set in current process
          } catch (error) {
            console.warn('Could not save API key to .env file:', error.message);
          }
          resolve(key.trim());
        } else {
          console.error('API key cannot be empty.');
          process.exit(1);
        }
      });
    });
    
    return apiKey;
  }

  /**
   * Generate content using Gemini
   * @param {Object} prompt - Formatted prompt for the LLM
   * @returns {Promise<string>} - LLM response
   */
  async generateContent(prompt) {
    try {
      // Implement retry with backoff logic
      return await this.retryWithBackoff(async () => {
        const response = await this.genAI.models.generateContent({
          model: this.modelName,
          contents: prompt.contents,
          config: {
            temperature: prompt.temperature || 0.7,
            topP: prompt.topP || 0.95,
            topK: prompt.topK || 40,
            maxOutputTokens: prompt.maxOutputTokens || 1024,
            systemInstruction: prompt.systemInstruction
            // Thinking configuration removed as it's not supported by all models
          }
        });

        // Correctly extract text content from the response structure
        // Check for candidates and parts before accessing text
        if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
          return response.candidates[0].content.parts[0].text;
        } else {
          // Log the unexpected response structure for debugging if no text is found
          console.warn('GeminiProvider: Unexpected response structure or no text content found in generateContent response:', JSON.stringify(response, null, 2));
          // Attempt to return any text found, or an empty string
          return response?.text || '';
        }
      });
    } catch (error) {
      console.error('Error calling Gemini:', error);
      throw error;
    }
  }

  /**
   * Generate content stream using Gemini API
   * @param {Object} prompt - Prompt object with contents and systemInstruction
   * @param {Function} onChunk - Callback function for each chunk of the response
   * @returns {Promise<string>} - Complete response text
   */
  async generateContentStream(prompt, onChunk) {
    try {
      // Use the models API directly for streaming
      const result = await this.genAI.models.generateContentStream({
        model: this.modelName,
        contents: prompt.contents,
        config: {
          temperature: 0.7,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 1024,
          systemInstruction: prompt.systemInstruction
        }
      });
      
      let fullResponse = '';
      
      // Process each chunk
      for await (const chunk of result) {
        const chunkText = chunk.text || '';
        fullResponse += chunkText;
        
        if (onChunk) {
          onChunk(chunkText);
        }
      }
      
      return fullResponse;
    } catch (error) {
      console.error('Error generating content stream:', error);
      throw error;
    }
  }

  /**
   * Helper function to implement retry with exponential backoff
   * @param {Function} operation - Async operation to retry
   * @param {number} maxRetries - Maximum number of retries
   * @param {number} initialDelay - Initial delay in milliseconds
   * @returns {Promise<any>} - Result of the operation
   */
  async retryWithBackoff(operation, maxRetries = 5, initialDelay = 1000) {
    let retries = 0;
    let delay = initialDelay;

    while (retries < maxRetries) {
      try {
        return await operation();
      } catch (error) {
        // Check if this is a server overload error
        const isOverloaded =
          error.message?.includes('UNAVAILABLE') ||
          error.message?.includes('overloaded') ||
          error.message?.includes('503') ||
          (error.status === 503);

        // If it's not an overload error or we've used all retries, throw
        if (!isOverloaded || retries >= maxRetries - 1) {
          throw error;
        }

        // Increment retry counter
        retries++;

        // Log the retry attempt
        console.log(`Model overloaded. Retry attempt ${retries}/${maxRetries} after ${delay}ms delay...`);

        // Wait for the delay period
        await new Promise(resolve => setTimeout(resolve, delay));

        // Exponential backoff with jitter
        delay = Math.min(delay * 2, 30000) * (0.8 + Math.random() * 0.4);
      }
    }
  }
}
