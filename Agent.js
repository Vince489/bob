import { ToolManager } from './ToolManager.js';
import { Memory } from './Memory.js';
import { LLMProcessor } from './LLMProcessor.js';
import { EventEmitter } from './utils/EventEmitter.js'; // Import from utils

export class Agent {
  constructor(config) {
    if (!config.role) {
      throw new Error("Agent role is required");
    }
    this.name = config.name;
    this.description = config.description;
    this.role = config.role;
    this.goals = config.goals || [];
    this.resume = config.resume || '';

    this.toolManager = new ToolManager(config.tools || {});
    this.memory = new Memory();

    this.llmConfig = config.llmConfig || {
      temperature: 0.7,
      maxOutputTokens: 1024
    };
    this.llmProvider = config.llmProvider;
    this.context = {};

    this.llmProcessor = new LLMProcessor(
      this.llmProvider,
      this.llmConfig,
      this.role,
      this.toolManager,
      this.goals,
      this.resume
    );

    // Initialize event emitter
    this.eventEmitter = new EventEmitter();
  }

  async run(input, context = {}) {
    if (!this.llmProvider) {
      throw new Error(`Agent ${this.name} has no LLM provider`);
    }

    // Get conversation history from memory
    const conversationHistory = this.memory.getConversationHistory();

    // Add conversation history to input if available
    const enhancedInput = conversationHistory ?
      `${input}\n\n${conversationHistory}` : input;

    this.context = { ...this.context, ...context };

    // Emit event before LLM call
    this.eventEmitter.emit('llmRequest', { input: enhancedInput, context: this.context });

    // Get the raw response from the LLMProcessor
    const rawResponse = await this.llmProcessor.generate(enhancedInput);

    // Emit event after LLM call
    this.eventEmitter.emit('llmResponse', { response: rawResponse });

    // Process tool calls if the tool manager has tools
    let finalResponse = rawResponse;
    if (this.toolManager.hasTools()) {
      // Emit event before tool processing (assuming processToolCalls identifies calls internally)
      // Note: For more granular events, ToolManager would need to emit them.
      this.eventEmitter.emit('toolProcessingStart', { rawResponse });
      finalResponse = await this.toolManager.processToolCalls(rawResponse);
      // Emit event after tool processing
      this.eventEmitter.emit('toolProcessingEnd', { finalResponse });
    }

    // Add the final, processed response to memory
    this.memory.add(input, finalResponse);
    // Emit event after memory update
    this.eventEmitter.emit('memoryUpdated', { input, response: finalResponse });
    return finalResponse;
  }

  addTool(name, fn) {
    this.toolManager.addTool(name, fn);
  }

  /**
   * Process a user message and generate a response
   * @param {Object} options - Processing options
   * @param {string} options.message - User message
   * @param {number} options.thinkingBudget - Optional thinking budget override
   * @returns {Promise<string>} - Agent response
   */
  async process({ message, thinkingBudget }) {
    try {
      // Format the prompt with system instructions, tools, etc.
      const prompt = this.formatPrompt(message);

      // Add thinking configuration if provided
      if (thinkingBudget) {
        prompt.thinkingBudget = thinkingBudget;
      } else if (this.config.thinkingConfig?.thinkingBudget) {
        prompt.thinkingBudget = this.config.thinkingConfig.thinkingBudget;
      }

      // Generate response using the LLM provider
      const response = await this.llmProvider.generateContent(prompt);

      // Process the response (e.g., execute tools)
      return this.processResponse(response);
    } catch (error) {
      console.error(`Error in ${this.config.name}:`, error);
      return `I encountered an error: ${error.message}`;
    }
  }

  /**
   * Run the agent with streaming response
   * @param {string} input - User input
   * @param {Function} onChunk - Callback for each chunk of the response
   * @returns {Promise<string>} - Complete agent response
   */
  async runStream(input, onChunk) {
    if (!this.llmProvider) {
      throw new Error(`Agent ${this.name} has no LLM provider`);
    }

    // Get conversation history from memory
    const conversationHistory = this.memory.getConversationHistory();

    // Add conversation history to input if available
    const enhancedInput = conversationHistory ?
      `${input}\n\n${conversationHistory}` : input;

    // Use the LLMProcessor to prepare the system instruction with role, goals, resume, and tools
    const systemInstruction = this.llmProcessor.prepareSystemInstruction();

    // Use the streaming method from the provider
    const prompt = {
      contents: [{ text: enhancedInput }],
      systemInstruction: systemInstruction
    };

    let fullResponse = '';

    // Create a wrapper for onChunk that collects the full response
    const chunkHandler = (chunk) => {
      fullResponse += chunk;

      // Call the original onChunk function
      if (onChunk) onChunk(chunk);
    };

    // Emit event before starting LLM stream
    this.eventEmitter.emit('llmStreamStart', { input: enhancedInput, context: this.context }); // Using context from constructor scope

    await this.llmProvider.generateContentStream(prompt, chunkHandler);

    // Emit event after LLM stream finished (before tool processing)
    this.eventEmitter.emit('llmStreamEnd', { fullResponse });

    // Process the full response for tool calls
    let processedResponse = fullResponse; // Keep this declaration
    if (this.toolManager.hasTools()) {
      // Emit event before tool processing
      this.eventEmitter.emit('toolProcessingStart', { rawResponse: fullResponse }); // Use fullResponse as raw input for tools
      processedResponse = await this.toolManager.processToolCalls(fullResponse);
      // Emit event after tool processing
      this.eventEmitter.emit('toolProcessingEnd', { finalResponse: processedResponse });

      // If the response was modified by tool processing, we need to output the difference
      if (processedResponse !== fullResponse && onChunk) {
        // Find the point where they start to differ
        let i = 0;
        while (i < fullResponse.length && i < processedResponse.length && fullResponse[i] === processedResponse[i]) {
          i++;
        }

        // Output the new content
        const newContent = processedResponse.slice(i);
        if (newContent && onChunk) {
          onChunk("\n\n" + newContent);
        }
      }
    }

    // Add to memory
    this.memory.add(input, processedResponse);
    // Emit event after memory update
    this.eventEmitter.emit('memoryUpdated', { input, response: processedResponse });

    return processedResponse;
  }
}
