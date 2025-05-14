import { Agent } from './Agent.js';
import { GeminiProvider } from './providers/GeminiProvider.js';
import { EventEmitter } from './utils/EventEmitter.js'; // Import the shared EventEmitter

// Load environment variables (optional but good practice if checking process.env)
import dotenv from 'dotenv';
dotenv.config();

/**
 * Factory class for creating agents with agent.js
 */
export class AgentFactory {
  /**
   * Create a new AgentFactory
   * @param {Object} config - Configuration object
   * @param {string} [config.defaultProvider='gemini'] - Default LLM provider to use
   * @param {Object} [config.apiKeys={}] - API keys for different providers (e.g., { gemini: '...', openai: '...' })
   * @param {Object} [config.tools={}] - Optional object of tools to register with the factory (toolName: implementation)
   */
  constructor(config = {}) {
    this.defaultProvider = config.defaultProvider || 'gemini';
    this.apiKeys = config.apiKeys || {};
    this.tools = {}; // Initialize as an empty object
    this.events = new EventEmitter(); // Factory can also emit events if needed

    // Register tools provided in the config
    if (config.tools) {
      for (const toolName in config.tools) {
        // Use hasOwnProperty to avoid iterating over prototype properties
        if (Object.prototype.hasOwnProperty.call(config.tools, toolName)) {
          this.registerTool(toolName, config.tools[toolName]);
        }
      }
    }
  }

  /**
   * Create multiple agents from a configuration object
   * @param {Object} agentsConfig - Object where keys are agent IDs and values are agent configurations
   * @returns {Object} - Object with created agent instances, keyed by their IDs
   */
  createAgents(agentsConfig) {
    const agents = {};

    for (const [agentId, agentConfig] of Object.entries(agentsConfig)) {
      try {
        // Ensure the agent config has the ID if not provided as key
        const configWithId = { ...agentConfig, id: agentConfig.id || agentId };
        agents[agentId] = this.createAgent(configWithId);
        this.events.emit('agentCreated', { agentId, agent: agents[agentId] });
      } catch (error) {
        console.error(`Error creating agent ${agentId}:`, error);
        this.events.emit('agentCreationFailed', { agentId, config: agentConfig, error });
        // Decide whether to throw or continue creating other agents
        // throw error; // Option: Stop creation on first error
      }
    }

    return agents;
  }

  /**
   * Register a tool that can be used by agents created by this factory
   * @param {string} toolName - Name of the tool
   * @param {Object} toolDefinition - Tool definition object (must include description, inputSchema, and execute method/function)
   */
  registerTool(toolName, toolDefinition) {
    // Validate the tool definition structure
    if (!toolDefinition || typeof toolDefinition !== 'object') {
        throw new Error(`Tool definition for "${toolName}" must be an object.`);
    }
    if (typeof toolDefinition.execute !== 'function') {
        throw new Error(`Tool definition for "${toolName}" must include an 'execute' function.`);
    }
     if (typeof toolDefinition.description !== 'string' || !toolDefinition.description) {
        throw new Error(`Tool definition for "${toolName}" must include a non-empty 'description' string.`);
    }
    if (typeof toolDefinition.inputSchema !== 'object' || toolDefinition.inputSchema === null) {
        throw new Error(`Tool definition for "${toolName}" must include an 'inputSchema' object.`);
    }

    // Store the complete tool definition
    this.tools[toolName] = toolDefinition; 
    console.log(`Tool registered with factory: ${toolName}`);
    this.events.emit('toolRegistered', { toolName, toolDefinition });
  }

  /**
   * Create an agent from a JSON configuration
   * @param {Object} agentConfig - Agent configuration (should include name, description, role, etc.)
   * @returns {Agent} - Created agent instance
   */
  createAgent(agentConfig) {
    // Ensure the agent has an ID (useful for tracking/management)
    const agentId = agentConfig.id || `agent-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const configWithId = { ...agentConfig, id: agentId };


    const providerName = (agentConfig.provider || this.defaultProvider).toLowerCase();

    // --- API Key Resolution ---
    let apiKey = this.apiKeys[providerName]; // Check factory config first
    if (!apiKey) {
      // Check environment variables as fallback
      if (providerName === 'gemini' && process.env.GEMINI_API_KEY) {
        apiKey = process.env.GEMINI_API_KEY;
        console.log(`Agent ${agentId}: Using GEMINI_API_KEY from environment variables.`);
      } else if (providerName === 'openai' && process.env.OPENAI_API_KEY) {
        // Example for future OpenAI support
        apiKey = process.env.OPENAI_API_KEY;
        console.log(`Agent ${agentId}: Using OPENAI_API_KEY from environment variables.`);
      }
      // Add checks for other providers here...
    }

    if (!apiKey) {
      throw new Error(`No API key found for provider '${providerName}' for agent '${agentId}'. Set it in factory config apiKeys or as an environment variable (e.g., GEMINI_API_KEY).`);
    }

    // --- LLM Provider Instantiation ---
    let llmProvider;
    switch (providerName) {
      case 'gemini':
        // Allow overriding model per agent, default to a common one
        const modelName = agentConfig.llmConfig?.model || 'gemini-2.0-flash-lite'; // Updated default
        llmProvider = new GeminiProvider(apiKey, modelName);
        break;
      // Add cases for other providers like 'openai' here...
      default:
        throw new Error(`Unsupported provider: ${providerName}`);
    }

    // --- Tool Resolution ---
    const agentTools = {};
    if (Array.isArray(agentConfig.tools)) {
      for (const toolName of agentConfig.tools) { // Process array of tool names
         if (typeof toolName === 'string') {
           if (!this.tools[toolName]) { // Look up the full definition in the factory's registry
             console.warn(`Warning: Tool "${toolName}" specified for agent ${agentId} but not registered in the factory.`);
             continue;
           }
           // Add the full tool definition to the agent's tool map
           agentTools[toolName] = this.tools[toolName]; 
         } else {
            console.warn(`Warning: Invalid tool name reference in agent ${agentId} config's tools array:`, toolName);
         }
      }
    } else if (agentConfig.tools && typeof agentConfig.tools === 'object') {
        // Allow providing tool definitions directly in agent config (less common with factory)
        console.warn(`Warning: Providing tool definitions directly in agent config for ${agentId}. Prefer registering tools with the factory and referencing by name.`);
        Object.assign(agentTools, agentConfig.tools);
    }


    // --- Final Agent Configuration ---
    const finalAgentConfig = {
      ...configWithId, // Includes id, name, description, role, goals etc.
      llmProvider,
      llmConfig: agentConfig.llmConfig || {}, // Pass LLM specific config
      tools: agentTools // Pass resolved tools
    };

    // Remove provider name from final config as it's handled
    delete finalAgentConfig.provider;

    console.log(`Creating agent: ${agentId} with provider: ${providerName}`);
    return new Agent(finalAgentConfig);
  }

   /**
   * Subscribe to factory events
   * @param {string} eventName - Event name ('agentCreated', 'agentCreationFailed', 'toolRegistered')
   * @param {Function} listener - Callback function
   * @returns {Function} - Unsubscribe function
   */
  on(eventName, listener) {
    return this.events.on(eventName, listener);
  }

  /**
   * Unsubscribe from factory events
   * @param {string} eventName - Event name
   * @param {Function} listenerToRemove - Listener function to remove
   */
  off(eventName, listenerToRemove) {
    this.events.off(eventName, listenerToRemove);
  }
}
