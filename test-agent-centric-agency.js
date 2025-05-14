import { AgentFactory } from './AgentFactory.js';
import { TeamFactory } from './TeamFactory.js';
import { AgencyFactory } from './AgencyFactory.js';
import { searchTool } from './tools/index.js'; // Assuming searchTool is exported from tools/index.js
import fs from 'fs/promises';
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
    console.log('Starting Agent-Centric Agency Test...');

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    // Path to the agent-centric config file
    const configPath = path.join(__dirname, 'agent-centric-agency-config.json');
    console.log(`Loading configuration from ${configPath}...`);

    // Create agent factory with API keys and available tools
    // Tools are registered here for the factory to make them available to agents
    const agentFactory = new AgentFactory({
      defaultProvider: 'gemini',
      apiKeys: {
        gemini: GEMINI_API_KEY
      }
    });

    // Register the search tool with the agent factory
    agentFactory.registerTool('search', searchTool);

    // Create team factory
    const teamFactory = new TeamFactory({ agentFactory });

    // Create agency factory
    const agencyFactory = new AgencyFactory({
      teamFactory,
      agentFactory // Pass agentFactory here as well if AgencyFactory needs it for loading
    });

    // Load the agency configuration from the file
    const agency = await agencyFactory.loadAgencyFromFile(configPath);

    console.log('Agency loaded successfully:');
    console.log('- name:', agency.name);
    console.log('- teams:', Object.keys(agency.teams));
    console.log('- workflows:', Object.keys(agency.workflows));

    // Define initial inputs for the workflow
    const initialInputs = {
      topic: 'The impact of AI on the future of work'
    };

    console.log(`Executing workflow 'createBlogPost' with topic: "${initialInputs.topic}"`);

    // Run the agency workflow
    const results = await agency.run('createBlogPost', initialInputs);

    // Display the results
    console.log('\n=== Agency Workflow Results ===\n');
    console.log('\n=== Agency Workflow Results ===\n');
    // console.log('Full results object:', JSON.stringify(results, null, 2)); // Optional: for deep debugging

    if (results.researchStep) {
        console.log('\n--- Research Results (output of researchStep, which ran performResearch job) ---');
        console.log(results.researchStep);
    } else {
        console.log('\n--- Research Results: Not found ---');
    }

    if (results.writingStep) {
        console.log('\n--- Final Blog Post (output of writingStep, which ran writeBlogPost job) ---');
        console.log(results.writingStep);
    } else {
        console.log('\n--- Final Blog Post: Not found ---');
    }

    console.log('\nAgent-Centric Agency test completed successfully!');

  } catch (error) {
    console.error('Error running agent-centric agency test:', error);
  }
}

// Run the test
runAgentCentricAgencyTest();
