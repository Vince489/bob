# Agency System

This extension to the project adds an Agency layer that sits above Teams, allowing for coordination of multiple teams in complex workflows.

## Architecture

The architecture follows the existing pattern of entity/factory pairs:

```
Agent/AgentFactory -> Team/TeamFactory -> Agency/AgencyFactory
```

Each layer builds on the previous one:
- Agents perform individual tasks using LLM providers and tools
- Teams coordinate multiple agents through jobs and workflows
- Agencies coordinate multiple teams through cross-team workflows

## Files

- `Agency.js` - The main Agency class that manages teams and workflows
- `AgencyFactory.js` - Factory class for creating Agency instances
- `agency-config.json` - Example configuration file
- `test-agency.js` - Example script demonstrating usage

## Usage

### Creating an Agency

```javascript
// Create the necessary factories
const agentFactory = new AgentFactory({ /* config */ });
const teamFactory = new TeamFactory({ agentFactory });
const agencyFactory = new AgencyFactory({ teamFactory });

// Create an agency from a configuration
const agency = agencyFactory.createAgency({
  name: "My Agency",
  description: "An agency that coordinates multiple teams",
  teams: {
    teamName: teamInstance
  },
  workflows: {
    workflowName: {
      steps: [
        {
          name: "step1",
          teamName: "teamName",
          workflowName: "teamWorkflow",
          inputMapping: {
            teamInput: "initialInputs.agencyInput"
          }
        }
        // More steps...
      ]
    }
  }
});
```

### Running an Agency Workflow

```javascript
// Run a workflow with initial inputs
const results = await agency.run("workflowName", { 
  agencyInput: "Some input value" 
});

// Access the results
console.log(results.step1); // Results from the first step
```

## Example: Blog Creation Agency

The included example demonstrates a blog creation agency with two teams:

1. **Research Team** - Uses a researcher agent with the search tool to gather information
2. **Writing Team** - Uses a writer agent to create blog posts based on research

The workflow connects these teams:
- The research team searches for information on a topic
- The writing team uses the research results to write a blog post

To run the example:

```bash
node test-agency.js
```

## Configuration Structure

Agency configurations follow this structure:

```json
{
  "agents": {
    "agentId": {
      "name": "Agent Name",
      "description": "Agent description",
      "role": "Agent role",
      "goals": ["Goal 1", "Goal 2"],
      "provider": "llm-provider",
      "llmConfig": {},
      "tools": ["tool1", "tool2"]
    }
  },
  "teams": {
    "teamId": {
      "name": "Team Name",
      "description": "Team description",
      "agents": ["agentId1", "agentId2"],
      "jobs": {
        "jobId": {
          "agentName": "agentId1",
          "inputPromptTemplate": "Template with {{variables}}"
        }
      },
      "workflow": ["jobId1", "jobId2"]
    }
  },
  "agency": {
    "agencyId": {
      "name": "Agency Name",
      "description": "Agency description",
      "teams": ["teamId1", "teamId2"],
      "workflows": {
        "workflowId": {
          "steps": [
            {
              "name": "stepName",
              "teamName": "teamId1",
              "workflowName": "teamWorkflow",
              "inputMapping": {
                "teamInput": "initialInputs.agencyInput"
              }
            }
          ]
        }
      }
    }
  }
}
```

## Event System

The Agency class emits events that you can listen to:

- `AgencyInitialized` - When the agency is created
- `TeamAdded` - When a team is added to the agency
- `WorkflowAdded` - When a workflow is added to the agency
- `AgencyWorkflowStart` - When a workflow starts
- `WorkflowStepStart` - When a workflow step starts
- `WorkflowStepInputPrepared` - When input for a step is prepared
- `WorkflowStepSuccess` - When a step completes successfully
- `WorkflowStepError` - When a step encounters an error
- `AgencyWorkflowEnd` - When a workflow completes

Team events are also forwarded with the prefix `team.{teamName}.{eventName}`.
