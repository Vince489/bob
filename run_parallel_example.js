import { AgentFactory } from './AgentFactory.js';
import { TeamFactory } from './TeamFactory.js';
import { AgencyFactory } from './AgencyFactory.js';

import { parallelExampleConfig } from './parallel_example_config.js'; // Import the named configuration
import dotenv from 'dotenv';

// Import tool definitions directly
import { calculatorTool } from './tools/calculatorTool.js';
// DescribeImageTool removed as per user feedback

// Load environment variables
dotenv.config();

// Instantiate factories
const agentFactory = new AgentFactory(); // Add config if needed from parallelExampleConfig
const teamFactory = new TeamFactory({ agentFactory });
const agencyFactory = new AgencyFactory({ teamFactory });

// Register tools with the factory at the top level (direct, unconditional)
console.log("--- Registering tools with AgentFactory (direct, top-level) ---");

// Register calculatorTool
// Assumes calculatorTool is a valid, imported tool definition object with a .name property.
// If not, this line or access to .name will throw an error.
agentFactory.registerTool(calculatorTool.name, calculatorTool);


console.log("--- Tool registration phase completed (direct, top-level) ---");


// Removed helper functions: extractToolDefinition, registerAllTools, loadAgentTools

async function main() {
  console.log("--- Setting up Parallel Execution Demo with Real Tools & LLM ---");
  // Tool registration moved to top level

  // 1. Create Teams from config using TeamFactory
  const teams = {};
  for (const teamName in parallelExampleConfig.teams) {
    const currentTeamConfigFromParallelExample = parallelExampleConfig.teams[teamName];
    const finalTeamConfigForFactory = { ...currentTeamConfigFromParallelExample };

    // IMPORTANT: This section assumes that parallelExampleConfig.js will be updated
    // so that each agent's 'tools' property is an ARRAY OF TOOL NAMES (strings)
    // that correspond to the names registered with agentFactory.
    if (finalTeamConfigForFactory.agentsConfig) {
      const processedAgentConfigs = {};
      for (const agentKey in finalTeamConfigForFactory.agentsConfig) {
        const originalAgentConfig = finalTeamConfigForFactory.agentsConfig[agentKey];
        // The 'tools' property from originalAgentConfig should now be an array of names.
        // AgentFactory will resolve these names from its registry.
        processedAgentConfigs[agentKey] = { 
          ...originalAgentConfig 
          // 'tools' property is passed as is from originalAgentConfig (expected to be an array of names)
        };
      }
      finalTeamConfigForFactory.agents = processedAgentConfigs; // TeamFactory expects 'agents'
      delete finalTeamConfigForFactory.agentsConfig; // Clean up
    } else {
      finalTeamConfigForFactory.agents = finalTeamConfigForFactory.agents || {}; // Ensure 'agents' property exists
    }
    
    try {
      teams[teamName] = teamFactory.createTeam(finalTeamConfigForFactory);
      console.log(`Team "${teamName}" created successfully via factory.`);
    } catch (error) {
      console.error(`Error creating team "${teamName}" via factory:`, error);
      // Decide if we should stop or continue
      // For this example, we'll log and continue, but in a real app, you might re-throw or exit.
    }
  }

  // 2. Create Agency using AgencyFactory
  const agencyConfigForFactory = {
    name: parallelExampleConfig.agencyName,
    description: parallelExampleConfig.agencyDescription,
    teams: teams, // Pass the already instantiated Team objects
    workflows: parallelExampleConfig.workflows,
  };
  
  let agency;
  try {
    agency = agencyFactory.createAgency(agencyConfigForFactory);
    console.log(`Agency "${agency.name}" created successfully via factory.`);
  } catch (error) {
    console.error(`Error creating agency "${parallelExampleConfig.agencyName}" via factory:`, error);
    process.exit(1); // Exit if agency creation fails
  }

  // 3. Run the main workflow
  const initialWorkflowInputs = {
    imageFile: 'imagen-1.png', // Changed to use imagen-1.png
    documentFile: 'example_document.txt',
    reportTitle: 'Demo Report'
  };

  console.log("\n--- Starting Agency Workflow: mainProcessingWorkflow ---");
  try {
    const results = await agency.run('mainProcessingWorkflow', initialWorkflowInputs);
    console.log("\n--- Agency Workflow Completed ---");
    console.log("Final Results:");
    console.log(JSON.stringify(results, null, 2));
  } catch (error) {
    console.error("\n--- Agency Workflow Failed ---");
    console.error(error);
  }
}

main();
