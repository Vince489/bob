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
      // If it's the first job in the team's workflow AND there are initialInputs for the team, use them.
      if (this.workflow.indexOf(jobName) === 0 && initialInputs && Object.keys(initialInputs).length > 0) {
        this._log('InputInfo', { jobName, message: 'No inputMapping for job, using initialInputs passed to team for the first job.'});
        return { ...initialInputs }; // Return a copy
      }
      // Otherwise, if no inputMapping and not the first job, or no initialInputs to the team, it gets an empty object.
      this._log('InputInfo', { jobName, message: 'No inputMapping for job. Not the first job or no initialInputs to team. Passing empty object to agent.'});
      return {};
    }

    // If there IS an inputMapping for the job, resolve it.
    const resolvedInputs = {};
    // Sources for input mapping:
    // 1. `initialInputs`: Inputs passed to the `team.run()` method. These are typically from the agency.
    // 2. `results`: Results from *previous jobs within this current team run*.
    const sources = {
      initialInputs: initialInputs, // Inputs from the agency/caller
      results: this.results      // Results from previous jobs in *this team's current workflow execution*
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

  async run(initialInputs = {}, initialContext = {}, jobNameToRun = null) {
    this._log('TeamRunStart', { 
      initialInputsCount: Object.keys(initialInputs).length, 
      contextKeys: Object.keys(initialContext),
      jobToRun: jobNameToRun || 'full workflow'
    });
    this.context = { ...initialContext }; // Set context for this run
    const teamRunResults = {}; // Use a temporary object for this run's job results

    if (jobNameToRun) {
      // Execute a single specified job
      const job = this.jobs[jobNameToRun];
      if (!job) {
        this._log('JobSkipped', { jobName: jobNameToRun, reason: 'Job definition not found (specified directly).' });
        this.results = { error: `Job ${jobNameToRun} not found.` }; // Set team's main result for single job run
        return this.results;
      }
      // For a single job run, it cannot be parallel with others in this context.
      // We use teamRunResults to store its output before assigning to this.results
      await this._executeJob(jobNameToRun, job, initialInputs, teamRunResults, true);
      this.results = teamRunResults[jobNameToRun]; // The result of the single job is the team's result

    } else {
      // Execute the full workflow
      let i = 0;
      while (i < this.workflow.length) {
        const currentJobName = this.workflow[i];
        const currentJobDefinition = this.jobs[currentJobName];

        if (!currentJobDefinition) {
          this._log('JobSkipped', { jobName: currentJobName, reason: 'Job definition not found in workflow.' });
          teamRunResults[currentJobName] = { error: `Job ${currentJobName} not found.` };
          i++;
          continue;
        }

        if (currentJobDefinition.parallel) {
          const parallelJobGroup = [];
          let j = i;
          // Collect all adjacent parallel jobs from the workflow
          while (j < this.workflow.length) {
            const jobNameInWorkflow = this.workflow[j];
            const jobDef = this.jobs[jobNameInWorkflow];
            if (jobDef && jobDef.parallel) {
              parallelJobGroup.push({ name: jobNameInWorkflow, definition: jobDef });
              j++;
            } else {
              break; // End of parallel block
            }
          }

          this._log('TeamParallelGroupStart', { teamName: this.name, groupSize: parallelJobGroup.length, jobs: parallelJobGroup.map(j => j.name) });

          const jobPromises = parallelJobGroup.map(jobInfo =>
            this._executeJob(jobInfo.name, jobInfo.definition, initialInputs, teamRunResults, false)
          );

          try {
            await Promise.all(jobPromises);
            // Results are already populated in teamRunResults by _executeJob
            this._log('TeamParallelGroupEnd', { teamName: this.name, groupSize: parallelJobGroup.length });
          } catch (error) {
            // Promise.all rejects on first error. Individual errors are logged in _executeJob.
            // This top-level catch is for the Promise.all itself.
            console.error(`Error executing parallel job group in team ${this.name}:`, error);
            this._log('TeamParallelGroupError', { teamName: this.name, error: error.message, stack: error.stack });
            // Potentially mark remaining jobs in group as errored if not already handled by _executeJob
          }
          i = j; // Move index past the processed parallel group
        } else {
          // Sequential job execution
          await this._executeJob(currentJobName, currentJobDefinition, initialInputs, teamRunResults, false);
          i++;
        }
      }
      this.results = teamRunResults; // Full workflow results
    }
    
    const finalResultsCount = (jobNameToRun)
        ? (this.results && typeof this.results === 'object' && !this.results.error ? 1 : (this.results && !this.results.error ? 1 : 0)) // Simplified: if single job, result is 1 item or error
        : Object.keys(this.results).length;
    this._log('TeamRunEnd', { finalResultsCount });
    return this.results;
  }

  /**
   * Executes a single job, whether sequential or part of a parallel batch.
   * Populates results into targetResultsObject.
   * @param {string} jobName - The name of the job.
   * @param {Object} job - The job definition.
   * @param {Object} initialInputs - Inputs passed to the team.run() method (used for _prepareJobInput).
   * @param {Object} targetResultsObject - The object where results for this job run should be stored.
   * @param {boolean} isSingleJobRunContext - True if the overall team.run is for a single job (affects how final team.results is set).
   * @private
   */
  async _executeJob(jobName, job, initialInputs, targetResultsObject, isSingleJobRunContext) {
    // Note: `this.results` in _prepareJobInput refers to the *cumulative results of prior jobs in the current team run*.
    // `targetResultsObject` is where the *current* job's result will be placed.
    // For the first job(s) in a run (or first parallel batch), `this.results` used by `_prepareJobInput` would be empty or from a previous sequential block.

    this._log('JobStart', { jobName, agentName: job.agentName, mode: job.parallel ? 'ParallelCandidate' : 'Sequential' });

    const agent = this.agents[job.agentName];
    if (!agent) {
      this._log('JobError', { jobName, agentName: job.agentName, error: 'Agent not found.' });
      targetResultsObject[jobName] = { error: `Agent ${job.agentName} not found for job ${jobName}.` };
      if (job.parallel) { // If a parallel job fails to find its agent, it should throw to reject Promise.all
          throw new Error(`Agent ${job.agentName} not found for job ${jobName}.`);
      }
      return; // For sequential, just record error and return
    }

    try {
      // Pass `targetResultsObject` to `_prepareJobInput` if inputs can come from other jobs in the same parallel batch.
      // Current design: `_prepareJobInput` uses `this.results` which are from *completed* (prior sequential or prior parallel batch) jobs.
      // This means jobs in the *same* parallel batch cannot directly depend on each other's outputs via `this.results`.
      // They would rely on `initialInputs` or results from prior sequential steps.
      const jobInputObject = this._prepareJobInput(jobName, initialInputs); // Uses this.results (previous jobs)
      this._log('JobInputPrepared', { jobName, inputObject: jobInputObject });

      let agentFeedInput;
      const inputKeys = Object.keys(jobInputObject);

      if (job.inputPromptTemplate && typeof job.inputPromptTemplate === 'string') {
          agentFeedInput = job.inputPromptTemplate.replace(/\{\{(\w+)\}\}/g, (match, key) => {
              return jobInputObject[key] !== undefined ? String(jobInputObject[key]) : (match);
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

      // Store result in the target object (teamRunResults)
      // If job.outputKey is present, try to extract; otherwise, store the whole agentResult.
      if (job.outputKey && typeof agentResult === 'object' && agentResult !== null && job.outputKey in agentResult) {
          targetResultsObject[jobName] = agentResult[job.outputKey];
      } else if (job.outputKey && (typeof agentResult !== 'object' || agentResult === null)) {
          console.warn(`[Team: ${this.name}] Job "${jobName}" has outputKey "${job.outputKey}" but agentResult is not an object/null. Storing direct agent result under jobName.`);
          targetResultsObject[jobName] = agentResult; // Store direct result if outputKey present but not extractable
      }
      else {
          targetResultsObject[jobName] = agentResult;
      }

    } catch (error) {
      console.error(`Error during job ${jobName}:`, error);
      this._log('JobError', { jobName, error: error.message, stack: error.stack });
      targetResultsObject[jobName] = { error: error.message, details: error.stack };
      if (job.parallel) { // If a parallel job errors during execution, throw to reject Promise.all
        throw error;
      }
    }
  }
}
