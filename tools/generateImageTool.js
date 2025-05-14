// tools/generateImageTool.js
import { GoogleGenAI, Modality } from "@google/genai";
import * as fs from "node:fs";
import path from 'node:path';

// Ensure API key is loaded from environment variables
// dotenv.config() should be called in the main application entry point.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// tools/generateImageTool.js
export const generateImageTool = {
  name: "generateImageTool",
  description: "Generates an image based on a textual description and saves it to a specified path.",
  inputSchema: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "A detailed textual description of the image to generate."
      },
      outputPath: {
        type: "string",
        description: "Optional. The file path to save the generated image (e.g., 'generated_image.png'). Defaults to 'gemini-generated-image.png' in the project root."
      }
    },
    required: ["prompt"]
  },
  async execute(args) {
    const { prompt, outputPath: providedOutputPath } = args;
    const outputPath = providedOutputPath || 'gemini-generated-image.png'; // Default output path

    if (!GEMINI_API_KEY) {
      return { error: "GEMINI_API_KEY environment variable not set." };
    }
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === "") {
      return { error: "Invalid or empty prompt provided." };
    }

    try {
      const ai = new GoogleGenAI(GEMINI_API_KEY); // Pass API key directly

      console.log(`[generateImageTool] Requesting image generation for prompt: "${prompt}"`);

      // Set responseModalities to include "Image" so the model can generate an image
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-preview-image-generation", // Corrected model name from image-tool-ideas.txt
        contents: [{ parts: [{ text: prompt }] }], // Ensure contents format matches SDK expectations
        // The example in image-tool-ideas.txt used 'config' directly, not 'generationConfig' for responseModalities
        // However, the SDK structure might vary. Let's try with the structure from image-tool-ideas.txt
        // Forcing Modality.TEXT as well, as the example did, to see if it returns any text part.
        config: { 
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });
      
      // The Gemini API for image generation might directly return image data
      // or require specific handling based on the model version.
      // The example in image-tool-ideas.txt iterates through parts.
      // Let's adapt that, assuming the SDK structure is similar for this model.

      if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.data) { // Check for inlineData which contains base64 image
            const imageData = part.inlineData.data;
            const buffer = Buffer.from(imageData, "base64");
            
            // Ensure directory exists
            const dir = path.dirname(outputPath);
            if (dir && !fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(outputPath, buffer);
            console.log(`[generateImageTool] Image saved as ${outputPath}`);
            return { success: true, message: `Image saved as ${outputPath}`, path: outputPath };
          }
        }
      }
      // Fallback or error if no image data found in the expected structure
      console.error("[generateImageTool] No image data found in the response.", JSON.stringify(response, null, 2));
      return { error: "No image data found in the API response." };

    } catch (error) {
      console.error("[generateImageTool] Error during image generation:", error);
      return { error: `Error during image generation: ${error.message}` };
    }
  }
};
