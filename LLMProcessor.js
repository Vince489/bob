export class LLMProcessor {
    constructor(llmProvider, llmConfig, role, toolManager, goals = [], resume = '') {
      this.llmProvider = llmProvider;
      this.llmConfig = llmConfig;
      this.role = role;
      this.toolManager = toolManager;
      this.goals = goals;
      this.resume = resume;
    }

    // Prepare system instruction with role, goals, resume, and tools
    prepareSystemInstruction() {
      let systemInstruction = this.role;

      // Add goals if they exist and aren't already in the role
      if (this.goals && this.goals.length > 0 && !this.role.includes('GOALS:')) {
        systemInstruction += '\n\nGOALS:';
        this.goals.forEach(goal => {
          systemInstruction += `\n- ${goal}`;
        });
      }

      // Add resume if it exists and isn't already in the role
      if (this.resume && this.resume.length > 0 && !this.role.includes('RESUME:')) {
        systemInstruction += '\n\nRESUME:\n' + this.resume;
      }

      // Add tool information dynamically if tools are available
      if (this.toolManager && this.toolManager.hasTools()) {
        const toolDefs = this.toolManager.getToolDefinitions();
        if (toolDefs.length > 0) {
            systemInstruction += "\n\n# AVAILABLE TOOLS";
            systemInstruction += "\nYou have access to the following tools. Use them when necessary to fulfill the user's request.";
            systemInstruction += "\nIMPORTANT: To use a tool, you MUST output the tool call in the following EXACT format, including the <tool_call> and </tool_call> XML tags:";
            systemInstruction += "\n<tool_call>{\"tool_name\": \"<name_of_tool>\", \"arguments\": {<arguments_json_object>}}</tool_call>";
            systemInstruction += "\nDo NOT wrap this <tool_call> block in markdown code fences (like ```json or ```).";
            systemInstruction += "\nThe 'arguments' object MUST strictly match the inputSchema provided for the tool.";
            systemInstruction += "\nAfter you output the <tool_call>, I will execute the tool and provide you with a <tool_result> or <tool_error>. You can then use this result to formulate your final response to the user.";
            systemInstruction += "\nDo NOT include the <tool_call> tag or tool results in your final response to the user unless explicitly asked to explain the process. Only use it when you need to execute a tool to get information.";

            systemInstruction += "\n\n## Tool Definitions:";
            toolDefs.forEach(tool => {
                systemInstruction += `\n### Tool: ${tool.name}`;
                systemInstruction += `\n- Description: ${tool.description}`;
                // Pretty print the schema for better readability in the prompt
                try {
                    const schemaString = JSON.stringify(tool.inputSchema, null, 2);
                    systemInstruction += `\n- Input Schema:\n\`\`\`json\n${schemaString}\n\`\`\``;
                } catch (e) {
                    console.error(`Error stringifying schema for tool ${tool.name}:`, e);
                    systemInstruction += `\n- Input Schema: (Error displaying schema)`;
                }
            });

             // Optional: Add a simple few-shot example
             systemInstruction += "\n\n## Tool Usage Example (Illustrative):";
             systemInstruction += "\nUser Query: What is 5 plus 7?";
             systemInstruction += "\nYour Action (Output): <tool_call>{\"tool_name\": \"calculatorTool\", \"arguments\": {\"expression\": \"5 + 7\"}}</tool_call>"; // Corrected tool name
             systemInstruction += "\n(I will then execute this and provide you the result, for example: <tool_result tool_name=\"calculatorTool\">The result of \"5 + 7\" is 12.</tool_result>)";
             systemInstruction += "\nThen you can formulate your response to the user, e.g., 'The result of 5 plus 7 is 12.'";

        }
      }

      return systemInstruction;
    }

    // Removed the old hardcoded getToolsDescription method

    async generate(input) {
      const contents = [{
        role: "user",
        parts: [{ text: input }]
      }];

      // Prepare system instruction with role, goals, resume, and tools
      const systemInstruction = this.prepareSystemInstruction();

      const response = await this.llmProvider.generateContent({
        contents,
        systemInstruction: systemInstruction,
        temperature: this.llmConfig.temperature,
        maxOutputTokens: this.llmConfig.maxOutputTokens
      });

      // Return the raw response; tool processing will be handled by the Agent
      return response;
    }


  }
