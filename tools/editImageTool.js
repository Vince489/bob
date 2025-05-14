// tools/editImageTool.js
import { GoogleGenAI, Modality } from "@google/genai";
import * as fs from "node:fs";
import path from 'node:path';

// Ensure API key is loaded from environment variables
// dotenv.config() should be called in the main application entry point.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// tools/editImageTool.js
export const editImageTool = {
  name: "editImageTool",
  description: "Edits an existing image based on a textual description and an input image, then saves it.",
  inputSchema: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "A textual description of the edits to perform on the image."
      },
      inputImagePath: {
        type: "string",
        description: "The file path of the image to be edited (e.g., 'path/to/image.png')."
      },
      outputPath: {
        type: "string",
        description: "Optional. The file path to save the edited image (e.g., 'edited_image.png'). Defaults to 'gemini-edited-image.png' in the project root."
      }
    },
    required: ["prompt", "inputImagePath"]
  },
  async execute(args) {
    const { prompt, inputImagePath, outputPath: providedOutputPath } = args;
    const outputPath = providedOutputPath || 'gemini-edited-image.png'; // Default output path

    if (!GEMINI_API_KEY) {
      return { error: "GEMINI_API_KEY environment variable not set." };
    }
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === "") {
      return { error: "Invalid or empty prompt provided." };
    }
    if (!inputImagePath || typeof inputImagePath !== 'string' || inputImagePath.trim() === "") {
      return { error: "Invalid or empty inputImagePath provided." };
    }

    try {
      if (!fs.existsSync(inputImagePath)) {
        return { error: `Input image not found at path: ${inputImagePath}` };
      }

      const ai = new GoogleGenAI(GEMINI_API_KEY); // Pass API key directly
      console.log(`[editImageTool] Requesting image editing for: "${inputImagePath}" with prompt: "${prompt}"`);

      // Load the image from the local file system
      const imageMimeType = path.extname(inputImagePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg'; // Basic MIME type detection
      const imageData = fs.readFileSync(inputImagePath);
      const base64Image = imageData.toString("base64");

      // Prepare the content parts
      const contents = [
        { text: prompt },
        {
          inlineData: {
            mimeType: imageMimeType,
            data: base64Image,
          },
        },
      ];

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-preview-image-generation", // Using the same model as per image-tool-ideas.txt
        contents: [{ parts: contents }], // Ensure contents format matches SDK expectations for multi-part
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });

      if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.data) {
            const outputImageData = part.inlineData.data;
            const buffer = Buffer.from(outputImageData, "base64");

            const dir = path.dirname(outputPath);
            if (dir && !fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(outputPath, buffer);
            console.log(`[editImageTool] Edited image saved as ${outputPath}`);
            return { success: true, message: `Edited image saved as ${outputPath}`, path: outputPath };
          }
        }
      }
      console.error("[editImageTool] No image data found in the API response.", JSON.stringify(response, null, 2));
      return { error: "No image data found in the API response for edited image." };

    } catch (error) {
      console.error("[editImageTool] Error during image editing:", error);
      return { error: `Error during image editing: ${error.message}` };
    }
  }
};
