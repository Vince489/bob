export const parallelExampleConfig = {
  agencyName: 'ParallelDemoAgencyRealTools',
  agencyDescription: 'Demonstrates parallel execution with actual tool loading and real LLM.',
  teams: {
    ImageProcessingTeam: {
      name: 'ImageProcessingTeam',
      description: 'Handles various image processing tasks in parallel.',
      agentsConfig: {
        Resizer: {
          name: 'ResizerAgent',
          description: 'Describes images.',
          role: 'Image Describer',
          goals: ['Describe images accurately', 'Use tools for metadata'],
          provider: 'gemini',
          llmConfig: { 
            model: 'gemini-2.0-flash-lite', 
            temperature: 0.5, 
            maxOutputTokens: 1024 
          },
          tools: [] // Removed describeImage tool, agent now has no tools
        },
        FilterApplier: {
          name: 'FilterAgent',
          description: 'Gets current time.',
          role: 'Time Reporter',
          goals: ['Report precise time', 'Sync with image context'],
          provider: 'gemini',
          llmConfig: { 
            model: 'gemini-2.0-flash-lite', 
            temperature: 0.5, 
            maxOutputTokens: 1024 
          },
          tools: [] // Changed to empty array
        }
        // MetaDataExtractor agent definition removed
      },
      jobs: {
        resizeImage: {
          agentName: 'Resizer',
          inputPromptTemplate: "Regarding the image {{imageName}}, provide a brief, general comment about image processing.",
          outputKey: 'imageDescription',
          parallel: true,
          inputMapping: { imageName: 'initialInputs.imageName' },
        }
        // Removed applyFilter job definition
        // Removed extractMeta job definition
      },
      workflow: ['resizeImage'], // Removed extractMeta and applyFilter from workflow
    },
    TextProcessingTeam: {
      name: 'TextProcessingTeam',
      description: 'Handles text analysis tasks with tools.',
      agentsConfig: {
        Summarizer: {
          name: 'SummarizerAgent',
          description: 'Calculates something for the document.',
          role: 'Document Calculator',
          goals: ['Compute document metrics', 'Use tools for analysis'],
          provider: 'gemini',
          llmConfig: { 
            model: 'gemini-2.0-flash-lite', 
            temperature: 0.5, 
            maxOutputTokens: 1024 
          },
          tools: ['calculatorTool'] // Changed to array of registered tool names
        },
        SentimentAnalyzer: {
          name: 'SentimentAgent',
          description: 'Gets current time for document context.',
          role: 'Document Time Reporter',
          goals: ['Timestamp documents', 'Sync with analysis'],
          provider: 'gemini',
          llmConfig: { 
            model: 'gemini-2.0-flash-lite', 
            temperature: 0.5, 
            maxOutputTokens: 1024 
          },
          tools: [] // Changed to empty array
        }
      },
      jobs: {
        summarizeDoc: {
          agentName: 'Summarizer',
          inputPromptTemplate: "Evaluate a simple metric for {{docName}} by calculating: 10*2",
          outputKey: 'docComplexity',
          parallel: true,
          inputMapping: { docName: 'initialInputs.docName' },
        }
        // Removed analyzeSentiment job
      },
      workflow: ['summarizeDoc'], // Removed analyzeSentiment from workflow
    }
  },
  workflows: {
    mainProcessingWorkflow: {
      name: 'MainProcessingWorkflow',
      description: 'Processes an image and a document in parallel using different teams with tools and real LLM.',
      steps: [
        {
          name: 'ImageTasks',
          teamName: 'ImageProcessingTeam',
          inputMapping: { imageName: 'initialInputs.imageFile' },
          outputKey: 'imageResults',
          parallel: true,
        },
        {
          name: 'TextTasks',
          teamName: 'TextProcessingTeam',
          inputMapping: { docName: 'initialInputs.documentFile' },
          outputKey: 'textResults',
          parallel: true,
        }
        // Removed FinalReportCalculation step
      ],
    },
  },
};
