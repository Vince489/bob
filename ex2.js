import { AgentFactory } from './AgentFactory.js';
import { TeamFactory } from './TeamFactory.js';
import { AgencyFactory } from './AgencyFactory.js';
import { searchTool, advancedImageGenerationTool } from './tools/index.js'; // Import both tools
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get the directory name
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Main function to run the test
async function runAgentCentricAgencyTest() {
  try {
    console.log('Starting Agent-Centric Agency Test with Image Generation...');

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    // Path to the agent-centric config file
    const configPath = path.join(__dirname, 'ex2.json');
    console.log(`Loading configuration from ${configPath}...`);

    // Create agent factory with API keys and available tools
    const agentFactory = new AgentFactory({
      defaultProvider: 'gemini',
      apiKeys: {
        gemini: GEMINI_API_KEY
      }
    });

    // Register the search tool with the agent factory
    agentFactory.registerTool('search', searchTool);

    // Register the advanced image generation tool
    agentFactory.registerTool('advancedImageGenerationTool', advancedImageGenerationTool);

    // Create team factory
    const teamFactory = new TeamFactory({ agentFactory });

    // Create agency factory
    const agencyFactory = new AgencyFactory({
      teamFactory,
      agentFactory
    });

    // Load the agency configuration from the file
    const agency = await agencyFactory.loadAgencyFromFile(configPath);

    console.log('Agency loaded successfully:');
    console.log('- name:', agency.name);
    console.log('- teams:', Object.keys(agency.teams));
    console.log('- workflows:', Object.keys(agency.workflows));

    // Define initial inputs for the workflow
    const initialInputs = {
      topic: 'Variety of native mangoes of south Florida'
    };

    console.log(`Executing workflow 'createBlogPostWithImage' with topic: "${initialInputs.topic}"`);

    // Run the agency workflow
    const results = await agency.run('createBlogPostWithImage', initialInputs);

    // Display the results
    console.log('\n=== Agency Workflow Results (with Image Generation) ===\n');

    if (results.researchStep) {
      console.log('\n--- Research Results (output of researchStep) ---');
      console.log(results.researchStep);
    } else {
      console.log('\n--- Research Results: Not found ---');
    }

    if (results.writingStep) {
      console.log('\n--- Final Blog Post (output of writingStep) ---');
      console.log(results.writingStep);
    } else {
      console.log('\n--- Final Blog Post: Not found ---');
    }

    if (results.promptingStep) {
      console.log('\n--- Image Prompt (output of promptingStep) ---');
      console.log(results.promptingStep);
    } else {
      console.log('\n--- Image Prompt: Not found ---');
    }

    if (results.imageGenerationStep) {
      console.log('\n--- Blog Image (output of imageGenerationStep) ---');
      console.log(results.imageGenerationStep);
    } else {
      console.log('\n--- Blog Image: Not found ---');
    }

    console.log('\nAgent-Centric Agency test with image generation completed successfully!');

  } catch (error) {
    console.error('Error running agent-centric agency test with image generation:', error);
  }
}

// Run the test
runAgentCentricAgencyTest();