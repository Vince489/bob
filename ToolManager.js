// Note: formatToolResult might need adjustment or replacement depending on desired output format
export class ToolManager {
    /**
     * Creates a ToolManager instance.
     * @param {Object} tools - An object where keys are tool names and values are full tool definition objects 
     *                         (including description, inputSchema, and execute function).
     */
    constructor(tools = {}) {
      // Store the full tool definitions provided by AgentFactory
      this.tools = tools; 
    }

    /**
     * Adds or updates a tool definition.
     * @param {string} name - The name of the tool.
     * @param {Object} toolDefinition - The full tool definition object.
     */
    addTool(name, toolDefinition) {
      // Basic validation could be added here if needed
      this.tools[name] = toolDefinition;
    }

    getToolNames() {
      return Object.keys(this.tools);
    }

    /**
     * Checks if any tools are registered.
     * @returns {boolean} True if tools exist, false otherwise.
     */
    hasTools() {
      return Object.keys(this.tools).length > 0;
    }

    /**
     * Gets the definitions (name, description, schema) for all registered tools.
     * Used to inform the LLM about available tools.
     * @returns {Array<Object>} An array of tool definition objects.
     */
    getToolDefinitions() {
        return Object.entries(this.tools).map(([name, toolDef]) => ({
            name: name,
            description: toolDef.description,
            inputSchema: toolDef.inputSchema
        }));
    }


    /**
     * Processes tool calls embedded in the LLM response string.
     * Looks for <tool_call>{"tool_name": "...", "arguments": {...}}</tool_call> format.
     * Executes the tools and replaces the calls with results.
     * @param {string} response - The raw response string from the LLM.
     * @returns {Promise<string>} The response string with tool calls replaced by results.
     */
    async processToolCalls(response) {
      let processedResponse = response;
      // Regex to find <tool_call> JSON blocks </tool_call>, optionally wrapped in markdown ```
      // It captures the <tool_call>...</tool_call> part and the JSON content within.
      const toolCallRegex = /(?:```(?:tool_call\s*)?\n?)?(<tool_call>[\s\S]*?<\/tool_call>)(?:\n?```)?/g;
      let match;
      const promises = []; // Store promises for concurrent execution

      while ((match = toolCallRegex.exec(response)) !== null) {
        const fullMatchWithOptionalTicks = match[0]; // The entire match, including optional ```
        const toolCallBlock = match[1]; // The <tool_call>...</tool_call> block
        
        // Extract JSON content from just the toolCallBlock
        const innerJsonRegex = /<tool_call>([\s\S]*?)<\/tool_call>/;
        const innerMatch = innerJsonRegex.exec(toolCallBlock);
        if (!innerMatch || !innerMatch[1]) {
            console.warn("Could not extract JSON from tool call block:", toolCallBlock);
            continue; 
        }
        const jsonContent = innerMatch[1];

        // Use a function scope to capture variables for the async operation
        const executeAndReplace = async () => {
          let toolName = 'unknown';
          let replacement = '';
          try {
            const parsedCall = JSON.parse(jsonContent);
            toolName = parsedCall.tool_name;
            const args = parsedCall.arguments;

            if (!toolName || typeof toolName !== 'string') {
              throw new Error("Invalid tool call format: Missing or invalid 'tool_name'.");
            }
            if (!args || typeof args !== 'object') {
               throw new Error(`Invalid tool call format for '${toolName}': Missing or invalid 'arguments' object.`);
            }

            const tool = this.tools[toolName];
            if (!tool || typeof tool.execute !== 'function') {
              throw new Error(`Tool '${toolName}' not found or has no execute method.`);
            }

            console.log(`Executing tool: ${toolName} with args:`, JSON.stringify(args));
            const result = await tool.execute(args);
            
            // Format the result
            // If the result is an object or array, stringify it to prevent "[object Object]"
            let resultString;
            if (typeof result === 'object' && result !== null) {
              resultString = JSON.stringify(result, null, 2); // Pretty print JSON
            } else {
              resultString = String(result); // Ensure it's a string
            }
            replacement = `\n<tool_result tool_name="${toolName}">\n${resultString}\n</tool_result>\n`;
            console.log(`Tool ${toolName} executed successfully.`);

          } catch (error) {
            console.error(`Error processing tool call for ${toolName}:`, error);
            // Format the error message
            replacement = `\n<tool_error tool_name="${toolName}">\nError: ${error.message}\n</tool_error>\n`;
          }
          // We need to replace the full match (including potential backticks)
          return { fullMatch: fullMatchWithOptionalTicks, replacement }; 
        };

        promises.push(executeAndReplace());
      }

      // Wait for all tool executions to complete
      const results = await Promise.all(promises);

      // Replace the tool calls in the original response string
      // Iterate results in reverse order to avoid index issues during replacement
      // Ensure we replace the correct fullMatch (which might include backticks)
      results.reverse().forEach(({ fullMatch, replacement }) => {
          processedResponse = processedResponse.replace(fullMatch, replacement);
      });

      return processedResponse;
    }
  }
