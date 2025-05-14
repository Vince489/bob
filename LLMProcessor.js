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
      // The logging for this is now at the top of the function.
      // We re-check here to append to systemInstruction string.
      if (this.toolManager && this.toolManager.hasTools()) {
        const toolDefs = this.toolManager.getToolDefinitions();
        if (toolDefs.length > 0) {
            systemInstruction += "\n\n# AVAILABLE TOOLS";
            systemInstruction += "\nYou have access to the following tools. Use them when necessary to fulfill the user's request.";
            systemInstruction += "\n\n**CRITICAL: To use a tool, your response MUST consist ONLY of the tool call in the following EXACT XML format:**";
            systemInstruction += "\n`<tool_call>{\"tool_name\": \"<name_of_tool>\", \"arguments\": {<arguments_json_object>}}</tool_call>`";
            systemInstruction += "\nDo NOT wrap this block in markdown code fences (```).";
            systemInstruction += "\nDo NOT write any text before or after this `<tool_call>` block.";
            systemInstruction += "\nDo NOT say you are going to use a tool (e.g., 'I will use the search tool'). Instead, directly output the `<tool_call>` block if you need to use a tool.";
            systemInstruction += "\nThe 'arguments' object MUST strictly match the inputSchema provided for the tool.";
            systemInstruction += "\nAfter your `<tool_call>` output, I will execute the tool and provide you with a `<tool_result>` or `<tool_error>`. You can then use this result to formulate your final response to the user.";
            systemInstruction += "\nOnly use tools when you need to gather external information or perform a calculation that you cannot do yourself.";

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
             systemInstruction += "\nYour *Exact* Output (should be only this line): `<tool_call>{\"tool_name\": \"calculatorTool\", \"arguments\": {\"expression\": \"5 + 7\"}}</tool_call>`";
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
