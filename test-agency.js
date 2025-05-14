import { AgentFactory } from './AgentFactory.js';
import { TeamFactory } from './TeamFactory.js';
import { AgencyFactory } from './AgencyFactory.js';
import { searchTool } from './tools/index.js';
import fs from 'fs/promises';

// Main function to run the test
async function runAgencyTest() {
  try {
    console.log('Starting Agency Test...');
    
    // Load the configuration file
    const configFile = './agency-config.json';
    console.log(`Loading configuration from ${configFile}...`);
    const configData = await fs.readFile(configFile, 'utf8');
    const config = JSON.parse(configData);
    
    // Set up API keys (replace with your actual API keys)
    const apiKeys = {
      gemini: process.env.GEMINI_API_KEY || 'your-gemini-api-key'
    };
    
    // Create the agent factory and register tools
    console.log('Creating AgentFactory and registering tools...');
    const agentFactory = new AgentFactory({
      defaultProvider: 'gemini',
      apiKeys
    });
    
    // Register the search tool
    agentFactory.registerTool('search', searchTool);
    
    // Create the team factory
    console.log('Creating TeamFactory...');
    const teamFactory = new TeamFactory({
      agentFactory
    });
    
    // Create teams for the agency
    console.log('Creating teams...');
    const researchTeamConfig = {
      ...config.teams.researchTeam,
      agents: config.teams.researchTeam.agents.reduce((acc, agentId) => {
        if (config.agents[agentId]) {
          acc[agentId] = config.agents[agentId];
        } else {
          console.warn(`Agent configuration for '${agentId}' not found in global config.`);
        }
        return acc;
      }, {})
    };
    const researchTeam = teamFactory.createTeam(researchTeamConfig);

    const writingTeamConfig = {
      ...config.teams.writingTeam,
      agents: config.teams.writingTeam.agents.reduce((acc, agentId) => {
        if (config.agents[agentId]) {
          acc[agentId] = config.agents[agentId];
        } else {
          console.warn(`Agent configuration for '${agentId}' not found in global config.`);
        }
        return acc;
      }, {})
    };
    const writingTeam = teamFactory.createTeam(writingTeamConfig);
    
    // Create the agency
    console.log('Creating agency...');
    const agency = new AgencyFactory({
      teamFactory
    }).createAgency({
      name: config.agency.blogCreationAgency.name,
      description: config.agency.blogCreationAgency.description,
      teams: {
        researchTeam,
        writingTeam
      },
      workflows: config.agency.blogCreationAgency.workflows
    });
    
    // Set up event listeners for the agency
    agency.on('AgencyWorkflowStart', (data) => {
      console.log(`Agency workflow started: ${data.workflowName}`);
    });
    
    agency.on('WorkflowStepStart', (data) => {
      console.log(`Workflow step started: ${data.stepName} (${data.teamName})`);
    });
    
    agency.on('WorkflowStepSuccess', (data) => {
      console.log(`Workflow step completed: ${data.stepName}`);
    });
    
    agency.on('AgencyWorkflowEnd', (data) => {
      console.log(`Agency workflow completed: ${data.workflowName}`);
    });
    
    // Run the agency workflow
    console.log('Running agency workflow...');
    const topic = 'The benefits of artificial intelligence in healthcare';
    const results = await agency.run('createBlogPost', { topic });
    
    // Display the results
    console.log('\n--- Research Results ---');
    console.log(results.research);
    
    console.log('\n--- Blog Post ---');
    console.log(results.writing);
    
    console.log('\nAgency test completed successfully!');
    
  } catch (error) {
    console.error('Error running agency test:', error);
  }
}

// Run the test
runAgencyTest();
