import { Agent } from './Agent.js';
import { EventEmitter } from './utils/EventEmitter.js';

export class Team {
  constructor(config) {
    this.name = config.name || 'Unnamed Team';
    this.description = config.description || '';
    this.agents = {}; // Stores Agent instances
    this.jobs = config.jobs || {}; // Job definitions: { agentName, inputMapping, inputPromptTemplate, outputKey }
    this.workflow = config.workflow || []; // Order of job names for execution
    this.eventEmitter = new EventEmitter();
    this.results = {}; // Stores results of each job run, keyed by jobName
    this.context = {}; // Shared context for the current team run

    if (config.agentsConfig) {
      for (const agentName in config.agentsConfig) {
        if (Object.hasOwnProperty.call(config.agentsConfig, agentName)) {
          this.addAgent(agentName, new Agent(config.agentsConfig[agentName]));
        }
      }
    } else if (config.agents) { 
      for (const agentName in config.agents) {
        if (Object.hasOwnProperty.call(config.agents, agentName)) {
            this.addAgent(agentName, config.agents[agentName]);
        }
      }
    }

    this._log('TeamInitialized', { name: this.name, description: this.description });
  }

  _log(eventName, data) {
    const logMessage = `[Team: ${this.name}] ${eventName}`;
    console.log(logMessage, data || '');
    this.eventEmitter.emit(eventName, { teamName: this.name, timestamp: new Date().toISOString(), ...data });
  }

  addAgent(name, agentInstance) {
    if (!(agentInstance instanceof Agent)) {
      console.error(`Error adding agent '${name}': Provided instance is not of type Agent.`);
      throw new Error(`Invalid agent instance for '${name}'. Must be an instance of Agent class.`);
    }
    this.agents[name] = agentInstance;
    this._log('AgentAdded', { agentName: name });
  }

  addJob(name, jobDefinition) {
    if (!jobDefinition || !jobDefinition.agentName) {
      throw new Error(`Job definition for '${name}' must include an 'agentName'.`);
    }
    this.jobs[name] = jobDefinition;
    this._log('JobAdded', { jobName: name, definition: jobDefinition });
  }

  setWorkflow(workflowArray) {
    if (!Array.isArray(workflowArray) || !workflowArray.every(item => typeof item === 'string')) {
        throw new Error('Workflow must be an array of job name strings.');
    }
    this.workflow = workflowArray;
    this._log('WorkflowSet', { workflow: workflowArray });
  }

  _resolveValue(path, sources) {
    const parts = path.split('.');
    let current = sources;
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined; 
      }
    }
    return current;
  }

  _prepareJobInput(jobName, initialInputs) {
    const job = this.jobs[jobName];
    if (!job) {
        this._log('InputPrepError', { jobName, message: 'Job definition not found for input preparation.' });
        return {};
    }

    if (!job.inputMapping) {
      if (this.workflow.indexOf(jobName) === 0 && initialInputs && Object.keys(initialInputs).length > 0) {
        this._log('InputInfo', { jobName, message: 'No inputMapping, using initialInputs for the first job.'});
        return initialInputs; 
      }
      this._log('InputInfo', { jobName, message: 'No inputMapping and not the first job, or no initialInputs. Passing empty object.'});
      return {};
    }

    const resolvedInputs = {};
    const sources = {
      initialInputs: initialInputs,
      results: this.results 
    };

    for (const key in job.inputMapping) {
      if (Object.hasOwnProperty.call(job.inputMapping, key)) {
        const path = job.inputMapping[key];
        const value = this._resolveValue(path, sources);
        if (value === undefined) {
          this._log('InputResolutionWarning', { jobName, inputKey: key, path, message: 'Path resolved to undefined.' });
        }
        resolvedInputs[key] = value;
      }
    }
    return resolvedInputs; 
  }

  async run(initialInputs = {}, initialContext = {}) {
    this._log('TeamRunStart', { initialInputsCount: Object.keys(initialInputs).length, contextKeys: Object.keys(initialContext) });
    this.results = {}; 
    this.context = { ...initialContext }; 

    for (const jobName of this.workflow) {
      const job = this.jobs[jobName];
      if (!job) {
        this._log('JobSkipped', { jobName, reason: 'Job definition not found.' });
        this.results[jobName] = { error: `Job ${jobName} not found.` };
        continue;
      }

      this._log('JobStart', { jobName, agentName: job.agentName });

      const agent = this.agents[job.agentName];
      if (!agent) {
        this._log('JobError', { jobName, agentName: job.agentName, error: 'Agent not found.' });
        this.results[jobName] = { error: `Agent ${job.agentName} not found for job ${jobName}.` };
        continue;
      }

      try {
        const jobInputObject = this._prepareJobInput(jobName, initialInputs);
        this._log('JobInputPrepared', { jobName, inputObject: jobInputObject });

        let agentFeedInput;
        const inputKeys = Object.keys(jobInputObject);

        if (job.inputPromptTemplate && typeof job.inputPromptTemplate === 'string') {
            agentFeedInput = job.inputPromptTemplate.replace(/\{\{(\w+)\}\}/g, (match, key) => {
                return jobInputObject[key] !== undefined ? String(jobInputObject[key]) : (match); // Keep original {{key}} if not found
            });
        } else if (inputKeys.length === 1) {
            agentFeedInput = jobInputObject[inputKeys[0]];
        } else if (inputKeys.length > 0) {
            agentFeedInput = JSON.stringify(jobInputObject, null, 2);
            this._log('JobInputSerialized', { jobName, message: 'Multiple input keys, no template, serialized to JSON.' });
        } else {
            agentFeedInput = ''; 
        }
        
        if (typeof agentFeedInput !== 'string') {
            agentFeedInput = String(agentFeedInput);
        }

        const agentResult = await agent.run(agentFeedInput, this.context);
        const resultPreview = typeof agentResult === 'string' ? (agentResult.length > 100 ? agentResult.substring(0, 97) + '...' : agentResult) : 'Non-string result';
        this._log('JobSuccess', { jobName, resultPreview });

        if (job.outputKey && typeof agentResult === 'object' && agentResult !== null && job.outputKey in agentResult) {
            this.results[jobName] = agentResult[job.outputKey];
        } else {
            this.results[jobName] = agentResult;
        }

      } catch (error) {
        console.error(`Error during job ${jobName}:`, error);
        this._log('JobError', { jobName, error: error.message, stack: error.stack });
        this.results[jobName] = { error: error.message, details: error.stack };
      }
    }

    this._log('TeamRunEnd', { finalResultsCount: Object.keys(this.results).length });
    return this.results;
  }
}
