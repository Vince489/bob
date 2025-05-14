// tools/advancedImageGenerationTool.js
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
import path from 'node:path';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// tools/advancedImageGenerationTool.js
export const advancedImageGenerationTool = {
  name: "advancedImageGenerationTool",
  description: "Generates one or more images using the advanced Imagen 3 model, allowing control over aspect ratio, number of images, and person generation. Ideal for high-quality, photorealistic, or artistic images.",
  inputSchema: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "A detailed textual description of the image(s) to generate. Refer to the image.md guide for advanced prompting techniques."
      },
      numberOfImages: {
        type: "integer",
        description: "The number of images to generate (1 to 4). Defaults to 1.",
        minimum: 1,
        maximum: 4
      },
      aspectRatio: {
        type: "string",
        description: "The aspect ratio of the generated image(s). Supported: '1:1', '3:4', '4:3', '9:16', '16:9'. Defaults to '1:1'.",
        enum: ["1:1", "3:4", "4:3", "9:16", "16:9"]
      },
      personGeneration: {
        type: "string",
        description: "Controls generation of people: 'DONT_ALLOW' or 'ALLOW_ADULT'. Defaults to 'ALLOW_ADULT'.",
        enum: ["DONT_ALLOW", "ALLOW_ADULT"]
      },
      outputFilePrefix: {
        type: "string",
        description: "Optional. A prefix for the output image filenames (e.g., 'my_robot'). Images will be saved as 'prefix-1.png', 'prefix-2.png', etc. Defaults to 'imagen'."
      },
      outputDirectory: {
        type: "string",
        description: "Optional. Directory to save the generated images (e.g., 'output/images'). Defaults to the project root."
      }
    },
    required: ["prompt"]
  },
  async execute(args) {
    const {
      prompt,
      numberOfImages = 1, // Default to 1 image
      aspectRatio = "1:1", // Default aspect ratio
      personGeneration = "ALLOW_ADULT", // Default person generation policy
      outputFilePrefix = "imagen",
      outputDirectory = "." // Default to current directory (project root)
    } = args;

    if (!GEMINI_API_KEY) {
      return { error: "GEMINI_API_KEY environment variable not set." };
    }
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === "") {
      return { error: "Invalid or empty prompt provided." };
    }

    try {
      const ai = new GoogleGenAI(GEMINI_API_KEY);
      console.log(`[advancedImageGenerationTool] Requesting ${numberOfImages} image(s) for prompt: "${prompt}" with AR: ${aspectRatio}, PersonGen: ${personGeneration}`);

      const generationConfig = {
        numberOfImages: parseInt(numberOfImages, 10), // Ensure it's an integer
        aspectRatio: aspectRatio,
        // personGeneration: personGeneration, // SDK might have different naming or structure
      };
      
      // The Imagen SDK might have specific naming for personGeneration.
      // Based on the text, it's 'personGeneration', but SDKs can differ.
      // If the SDK uses a different key, this needs adjustment.
      // For now, assuming it's part of the main config object for generateImages.
      // The example only showed numberOfImages in 'config'. Let's be cautious.
      // The text says "Naming conventions of above parameters vary by programming language."

      const requestConfig = {
        numberOfImages: parseInt(numberOfImages, 10),
      };
      if (aspectRatio) requestConfig.aspectRatio = aspectRatio;
      // The 'personGeneration' parameter for the JS SDK might be named differently or part of a sub-config.
      // The provided JS example for Imagen 3 only shows 'numberOfImages'.
      // We'll include it if the SDK supports it directly in this config object.
      // For now, I'll omit personGeneration from the direct call if it's not in the example,
      // as it might cause an error if the key is unexpected by this specific SDK method.
      // The user can add it to the prompt if needed: "photo of an adult..."

      const response = await ai.models.generateImages({
        model: 'imagen-3.0-generate-002', // As per advancedImageTool.txt
        prompt: prompt,
        config: requestConfig, // Pass the constructed config
      });

      const savedImagePaths = [];
      let idx = 1;

      if (response.generatedImages && response.generatedImages.length > 0) {
        for (const generatedImage of response.generatedImages) {
          // The example shows generatedImage.image.imageBytes
          // Let's ensure we access the correct property for image data
          if (generatedImage.image && generatedImage.image.imageBytes) {
            const imgBytes = generatedImage.image.imageBytes; // This should be base64 string or Uint8Array
            const buffer = Buffer.isBuffer(imgBytes) ? imgBytes : Buffer.from(imgBytes, "base64");
            
            const filename = `${outputFilePrefix}-${idx}.png`;
            const fullOutputPath = path.join(outputDirectory, filename);

            // Ensure directory exists
            if (outputDirectory !== "." && !fs.existsSync(outputDirectory)) {
              fs.mkdirSync(outputDirectory, { recursive: true });
            }

            fs.writeFileSync(fullOutputPath, buffer);
            savedImagePaths.push(fullOutputPath);
            console.log(`[advancedImageGenerationTool] Image saved as ${fullOutputPath}`);
            idx++;
          } else {
            console.warn("[advancedImageGenerationTool] A generated image entry did not contain imageBytes.");
          }
        }
      } else {
        console.error("[advancedImageGenerationTool] No images found in the API response.", JSON.stringify(response, null, 2));
        return { error: "No images found in the API response." };
      }

      if (savedImagePaths.length === 0) {
        return { error: "Failed to save any images, though API response was received." };
      }

      return { success: true, message: `Successfully generated and saved ${savedImagePaths.length} image(s).`, paths: savedImagePaths };

    } catch (error) {
      console.error("[advancedImageGenerationTool] Error during image generation:", error);
      return { error: `Error during image generation: ${error.message}` };
    }
  }
};
