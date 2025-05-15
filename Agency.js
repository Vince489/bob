import { Team } from './Team.js';
import { EventEmitter } from './utils/EventEmitter.js';

/**
 * Agency class for managing multiple teams and coordinating workflows across them
 */
export class Agency {
  /**
   * Create a new Agency
   * @param {Object} config - Agency configuration
   * @param {string} [config.name='Unnamed Agency'] - Agency name
   * @param {string} [config.description=''] - Agency description
   * @param {Object} [config.teams={}] - Object containing Team instances
   * @param {Object} [config.workflows={}] - Workflow definitions
   */
  constructor(config) {
    this.name = config.name || 'Unnamed Agency';
    this.description = config.description || '';
    this.teams = {}; // Stores Team instances
    this.workflows = config.workflows || {}; // Workflow definitions: { steps: [{ teamName, workflowName, inputMapping, outputKey }] }
    this.eventEmitter = new EventEmitter();
    this.results = {}; // Stores results of each workflow run
    this.context = {}; // Shared context for the current agency run
    
    // Add teams from config
    if (config.teams) {
      for (const teamName in config.teams) {
        if (Object.hasOwnProperty.call(config.teams, teamName)) {
          this.addTeam(teamName, config.teams[teamName]);
        }
      }
    }

    this._log('AgencyInitialized', { name: this.name, description: this.description });
  }

  /**
   * Log an event and emit it through the event emitter
   * @param {string} eventName - Name of the event
   * @param {Object} data - Event data
   * @private
   */
  _log(eventName, data) {
    const logMessage = `[Agency: ${this.name}] ${eventName}`;
    console.log(logMessage, data || '');
    this.eventEmitter.emit(eventName, { agencyName: this.name, timestamp: new Date().toISOString(), ...data });
  }

  /**
   * Add a team to the agency
   * @param {string} name - Team name
   * @param {Team} teamInstance - Team instance
   */
  addTeam(name, teamInstance) {
    if (!(teamInstance instanceof Team)) {
      console.error(`Error adding team '${name}': Provided instance is not of type Team.`);
      throw new Error(`Invalid team instance for '${name}'. Must be an instance of Team class.`);
    }
    this.teams[name] = teamInstance;
    this._log('TeamAdded', { teamName: name });

    // Forward team events to agency level with team name prefix
    teamInstance.eventEmitter.on('*', (eventName, eventData) => {
      this.eventEmitter.emit(`team.${name}.${eventName}`, eventData);
    });
  }

  /**
   * Add a workflow to the agency
   * @param {string} name - Workflow name
   * @param {Object} workflowDefinition - Workflow definition
   * @param {Array} workflowDefinition.steps - Array of workflow steps
   */
  addWorkflow(name, workflowDefinition) {
    if (!workflowDefinition || !Array.isArray(workflowDefinition.steps)) {
      throw new Error(`Workflow definition for '${name}' must include a 'steps' array.`);
    }
    this.workflows[name] = workflowDefinition;
    this._log('WorkflowAdded', { workflowName: name, definition: workflowDefinition });
  }

  /**
   * Resolve a value from a path in the sources object
   * @param {string} path - Path to the value (e.g., 'results.step1.output')
   * @param {Object} sources - Sources object
   * @returns {*} - Resolved value
   * @private
   */
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

  /**
   * Prepare input for a workflow step
   * @param {Object} step - Workflow step
   * @param {Object} initialInputs - Initial inputs
   * @param {Object} stepResults - Results from previous steps
   * @returns {Object} - Prepared input
   * @private
   */
  _prepareStepInput(step, initialInputs, stepResults) {
    if (!step.inputMapping) {
      return initialInputs;
    }

    const resolvedInputs = {};
    const sources = {
      initialInputs: initialInputs,
      results: stepResults,
      context: this.context
    };

    for (const key in step.inputMapping) {
      if (Object.hasOwnProperty.call(step.inputMapping, key)) {
        const path = step.inputMapping[key];
        const value = this._resolveValue(path, sources);
        if (value === undefined) {
          this._log('InputResolutionWarning', { step: step.name || `${step.teamName}:${step.workflowName}`, inputKey: key, path, message: 'Path resolved to undefined.' });
        }
        resolvedInputs[key] = value;
      }
    }
    return resolvedInputs; 
  }

  /**
   * Run a specific workflow
   * @param {string} workflowName - Name of the workflow to run
   * @param {Object} initialInputs - Initial inputs for the workflow
   * @param {Object} initialContext - Initial context for the workflow
   * @returns {Promise<Object>} - Results of the workflow
   */
  async run(workflowName, initialInputs = {}, initialContext = {}) {
    this._log('AgencyWorkflowStart', { workflowName, initialInputsCount: Object.keys(initialInputs).length });
    
    const workflow = this.workflows[workflowName];
    if (!workflow) {
      throw new Error(`Workflow '${workflowName}' not found.`);
    }

    this.context = { ...initialContext };
    const stepResults = {};
    let i = 0;

    while (i < workflow.steps.length) {
      const currentStepConfig = workflow.steps[i];
      const currentStepName = currentStepConfig.name || `step${i + 1}`;

      if (currentStepConfig.parallel) {
        const parallelGroup = [];
        let j = i;
        // Collect all adjacent parallel steps
        while (j < workflow.steps.length && workflow.steps[j].parallel) {
          const parallelStepConfig = workflow.steps[j];
          const parallelStepName = parallelStepConfig.name || `step${j + 1}`;
          parallelGroup.push({ config: parallelStepConfig, name: parallelStepName, originalIndex: j });
          j++;
        }

        this._log('WorkflowParallelGroupStart', { workflowName, groupSize: parallelGroup.length, steps: parallelGroup.map(s => s.name) });

        const promises = parallelGroup.map(async (stepInfo) => {
          const { config: step, name: stepName } = stepInfo;
          this._log('WorkflowStepStart (Parallel)', { workflowName, stepName, teamName: step.teamName, teamWorkflow: step.workflowName });

          const team = this.teams[step.teamName];
          if (!team) {
            this._log('WorkflowStepError (Parallel)', { workflowName, stepName, error: `Team '${step.teamName}' not found.` });
            return { stepName, error: `Team '${step.teamName}' not found.` };
          }

          try {
            // IMPORTANT: _prepareStepInput uses stepResults, which should only contain results from *previous sequential* steps.
            // For parallel steps, their inputs should not depend on each other's outputs from the *same* parallel batch.
            const stepInput = this._prepareStepInput(step, initialInputs, stepResults);
            this._log('WorkflowStepInputPrepared (Parallel)', { workflowName, stepName, inputObject: stepInput });

            const result = await team.run(stepInput, this.context, step.workflowName);

            let processedResult;
            if (step.outputKey && typeof result === 'object' && result !== null && step.outputKey in result) {
              processedResult = result[step.outputKey];
            } else if (step.outputKey && typeof result === 'object' && result !== null) {
              console.warn(`[Agency] OutputKey "${step.outputKey}" for parallel step "${stepName}" not found directly in team results. Storing full team result.`);
              processedResult = result;
            } else {
              processedResult = result;
            }
            this._log('WorkflowStepSuccess (Parallel)', { workflowName, stepName, resultSummary: typeof processedResult === 'object' ? `Object with keys: ${Object.keys(processedResult || {}).join(', ')}` : 'String result' });
            return { stepName, data: processedResult };
          } catch (error) {
            console.error(`Error during parallel workflow step ${stepName}:`, error);
            this._log('WorkflowStepError (Parallel)', { workflowName, stepName, error: error.message, stack: error.stack });
            return { stepName, error: error.message, details: error.stack };
          }
        });

        try {
          const groupResults = await Promise.all(promises);
          groupResults.forEach(res => {
            if (res.error) {
              stepResults[res.stepName] = { error: res.error, details: res.details };
            } else {
              stepResults[res.stepName] = res.data;
            }
          });
          this._log('WorkflowParallelGroupEnd', { workflowName, groupSize: parallelGroup.length });
        } catch (error) {
          // This catch block might be redundant if Promise.all itself doesn't throw for individual promise rejections,
          // but rather returns an array of settled promises (if using Promise.allSettled, which we are not here).
          // With Promise.all, it rejects on the first error.
          console.error(`Error executing parallel group in workflow ${workflowName}:`, error);
          this._log('WorkflowParallelGroupError', { workflowName, error: error.message, stack: error.stack });
          // Decide how to handle partial failures within a group if Promise.all rejects.
          // For now, the individual error logging within the map should capture issues.
          // We might need to mark all steps in the failed group as errored if not already.
        }
        i = j; // Move index past the processed parallel group
      } else {
        // Sequential step execution (original logic)
        const step = currentStepConfig;
        const stepName = currentStepName;

        this._log('WorkflowStepStart (Sequential)', { workflowName, stepName, teamName: step.teamName, teamWorkflow: step.workflowName });
        
        const team = this.teams[step.teamName];
        if (!team) {
          this._log('WorkflowStepError (Sequential)', { workflowName, stepName, error: `Team '${step.teamName}' not found.` });
          stepResults[stepName] = { error: `Team '${step.teamName}' not found.` };
          i++;
          continue;
        }

        try {
          const stepInput = this._prepareStepInput(step, initialInputs, stepResults);
          this._log('WorkflowStepInputPrepared (Sequential)', { workflowName, stepName, inputObject: stepInput });

          let result = await team.run(stepInput, this.context, step.workflowName);

          if (step.outputKey && typeof result === 'object' && result !== null && step.outputKey in result) {
            stepResults[stepName] = result[step.outputKey];
          } else if (step.outputKey && typeof result === 'object' && result !== null) {
            console.warn(`[Agency] OutputKey "${step.outputKey}" for sequential step "${stepName}" not found directly in team results. Storing full team result.`);
            stepResults[stepName] = result;
          } else {
            stepResults[stepName] = result;
          }
          this._log('WorkflowStepSuccess (Sequential)', { workflowName, stepName, resultSummary: typeof result === 'object' ? `Object with keys: ${Object.keys(result || {}).join(', ')}` : 'String result' });
        } catch (error) {
          console.error(`Error during sequential workflow step ${stepName}:`, error);
          this._log('WorkflowStepError (Sequential)', { workflowName, stepName, error: error.message, stack: error.stack });
          stepResults[stepName] = { error: error.message, details: error.stack };
        }
        i++;
      }
    }

    this.results[workflowName] = stepResults;
    this._log('AgencyWorkflowEnd', { workflowName, resultCount: Object.keys(stepResults).length });
    return stepResults;
  }

  /**
   * Run a specific team with given inputs
   * @param {string} teamName - Name of the team to run
   * @param {Object} inputs - Inputs for the team
   * @param {Object} context - Context for the team
   * @returns {Promise<Object>} - Results of the team run
   */
  async runTeam(teamName, inputs = {}, context = {}) {
    this._log('TeamRunStart', { teamName });
    
    const team = this.teams[teamName];
    if (!team) {
      throw new Error(`Team '${teamName}' not found.`);
    }

    try {
      const mergedContext = { ...this.context, ...context };
      const result = await team.run(inputs, mergedContext);
      this._log('TeamRunSuccess', { teamName });
      return result;
    } catch (error) {
      console.error(`Error running team ${teamName}:`, error);
      this._log('TeamRunError', { teamName, error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Subscribe to agency events
   * @param {string} eventName - Event name
   * @param {Function} listener - Callback function
   * @returns {Function} - Unsubscribe function
   */
  on(eventName, listener) {
    return this.eventEmitter.on(eventName, listener);
  }

  /**
   * Unsubscribe from agency events
   * @param {string} eventName - Event name
   * @param {Function} listenerToRemove - Listener function to remove
   */
  off(eventName, listenerToRemove) {
    this.eventEmitter.off(eventName, listenerToRemove);
  }
}
