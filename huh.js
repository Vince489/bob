import { AgentFactory } from '../../AgentFactory.js';
import { TeamFactory } from '../../TeamFactory.js';
import { AgencyFactory } from '../../AgencyFactory.js';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs/promises';  // Add this import for file operations
import { searchTool } from '../../searchTool.js'; // Import the searchTool

// Load environment variables
dotenv.config();

async function main() {
  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    // Create agent factory with API keys and available tools
    // The AgentFactory no longer manages the ToolHandler, as it's integrated into Agent
    const agentFactory = new AgentFactory({
      defaultProvider: 'gemini',
      apiKeys: {
        gemini: GEMINI_API_KEY
      },
      tools: { // Provide the available tools here
        search: searchTool // Map the logical name "search" to the searchTool instance
      }
    });

    // No tools needed for the content creation team in this example

    // Create team factory
    const teamFactory = new TeamFactory({ agentFactory });

    // Create agency factory
    const agencyFactory = new AgencyFactory({ 
      teamFactory, 
      agentFactory 
    });

    // Get the directory name
    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    // Path to the new config file
    const configPath = path.join(__dirname, 'content-creators-config.json');

    // Load content creation agency configuration
    const agency = await agencyFactory.loadAgencyFromFile(configPath);

    console.log('Agency loaded successfully:');
    console.log('- name:', agency.name);
    console.log('- team:', Object.keys(agency.team));
    console.log('- brief:', Object.keys(agency.brief));

    console.log('Executing brief: blog-post-007');

    // Extract inputs from the brief for the blog post
    const brief = agency.brief['blog-post-007'];

    // Assign the job to the content creation team
    console.log('Assigning job to content creation team...');
    agency.assignJob('blog-post-007', 'contentCreationTeam', 'team');

    // Execute the content creation workflow with explicit inputs
    console.log('Executing job...');
    console.log('Using inputs:');
    console.log('- topic:', brief.topic);
    console.log('- brief:', brief);

    const results = await agency.execute('blog-post-007', {
      topic: brief.topic,
      brief: brief
    });

    console.log('Job execution completed with results:', Object.keys(results));

    console.log('\n=== CONTENT CREATION RESULTS ===\n');

    console.log('Results object contains keys:', Object.keys(results));

    if (results.generateIdeas) {
      console.log('Generated Ideas (length:', results.generateIdeas.length, 'characters):');
      console.log(results.generateIdeas);
      console.log('\n');
    } else {
      console.log('WARNING: No generateIdeas results found!');
    }

    if (results.writeContent) {
      console.log('Draft Content (length:', results.writeContent.length, 'characters):');
      console.log(results.writeContent);
      console.log('\n');
    } else {
      console.log('WARNING: No writeContent results found!');
    }

    if (results.refineContent) {
      console.log('Refined Content (length:', results.refineContent.length, 'characters):');
      console.log(results.refineContent);
      console.log('\n');
    } else {
      console.log('WARNING: No refineContent results found!');
    }

    // Save results to a Markdown file
    let markdownContent = '# CONTENT CREATION RESULTS\n\n';
    markdownContent += `Results object contains keys: [ ${Object.keys(results).join(', ')} ]\n\n`;
    
    if (results.generateIdeas) {
      markdownContent += `## Generated Ideas (length: ${results.generateIdeas.length} characters):\n${results.generateIdeas}\n\n`;
    }
    
    if (results.writeContent) {
      markdownContent += `## Draft Content (length: ${results.writeContent.length} characters):\n${results.writeContent}\n\n`;
    }
    
    if (results.refineContent) {
      markdownContent += `## Refined Content (length: ${results.refineContent.length} characters):\n${results.refineContent}\n\n`;
    }
    
    const resultsFilePath = path.join(__dirname, 'content-results.md');
    await fs.writeFile(resultsFilePath, markdownContent, 'utf8');
    console.log(`Results saved to ${resultsFilePath}`);

    console.log('Content creation workflow completed successfully!');

  } catch (error) {
    console.error('Error:', error);
  }
}

main();
