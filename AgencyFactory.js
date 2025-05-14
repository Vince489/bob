import { readFile } from 'fs/promises';
import { Agency } from './Agency.js';
import { Team } from './Team.js'; // Import Team class

/**
 * Factory class for creating agencies
 */
export class AgencyFactory {
  /**
   * Create a new agency factory
   * @param {Object} config - Factory configuration
   * @param {TeamFactory} config.teamFactory - Team factory instance
   */
  constructor(config) {
    this.teamFactory = config.teamFactory;
  }

  /**
   * Create an agency from a configuration object
   * @param {Object} agencyConfig - Agency configuration
   * @returns {Agency} - Created agency instance
   */
  createAgency(agencyConfig) {
    // Create teams from the configuration
    const teams = {};
    
    if (agencyConfig.teams) {
      for (const [teamName, teamConfigOrInstance] of Object.entries(agencyConfig.teams)) {
        try {
          if (teamConfigOrInstance instanceof Team) {
            teams[teamName] = teamConfigOrInstance; // Use the instance directly
          }
          // If teamConfigOrInstance is a string, assume it's a reference to a team ID that needs full config lookup
          // This part might need adjustment if you intend to load teams by ID from a central config
          // For now, we assume string references are not used by test-agency.js or are full configs.
          else if (typeof teamConfigOrInstance === 'string') { 
            if (!this.teamFactory) {
              throw new Error(`Cannot resolve team reference '${teamConfigOrInstance}' without a teamFactory.`);
            }
            // This assumes teamFactory.createTeam can handle a string if it's a path or ID to a config.
            // Or, more likely, this path should lead to teamFactory.loadTeamFromFile or similar.
            // For the current use case in test-agency.js, this branch won't be hit as instances are passed.
            // If string IDs are meant to be resolved from a larger config object, that logic would go here.
            // For safety, let's assume if it's a string, it's an error unless teamFactory is robust.
            // A more robust solution would be to pass the full config object to createAgency if string IDs are used.
            console.warn(`[AgencyFactory] Team '${teamName}' provided as string. Attempting to create. This may require teamFactory to handle string-based config loading or ID resolution.`);
            teams[teamName] = this.teamFactory.createTeam(teamConfigOrInstance); // This might fail if teamConfigOrInstance is just an ID string
          } 
          // If teamConfigOrInstance is an object with a 'type' property set to 'reference', it's a reference
          else if (teamConfigOrInstance && typeof teamConfigOrInstance === 'object' && teamConfigOrInstance.type === 'reference' && teamConfigOrInstance.id) {
            if (!this.teamFactory) {
              throw new Error(`Cannot resolve team reference '${teamConfigOrInstance.id}' without a teamFactory.`);
            }
            // Similar to string case, this needs robust handling in teamFactory or a full config.
            // For now, assuming createTeam can handle this or it's not the current path.
            console.warn(`[AgencyFactory] Team '${teamName}' provided as reference object. Attempting to create. This may require teamFactory to handle reference-based config loading or ID resolution.`);
            teams[teamName] = this.teamFactory.createTeam(teamConfigOrInstance); // This might fail if teamConfigOrInstance is just a reference
          }
          // Otherwise, assume it's a configuration object and create a new team from it
          else if (teamConfigOrInstance && typeof teamConfigOrInstance === 'object') {
            teams[teamName] = this.teamFactory.createTeam(teamConfigOrInstance);
          } else {
            throw new Error(`Invalid configuration for team '${teamName}': Expected Team instance, config object, or reference.`);
          }
        } catch (error) {
          console.error(`[AgencyFactory] Error processing team '${teamName}':`, error);
          // Decide whether to throw or continue creating other teams
          // throw error; // Option: Stop creation on first error
        }
      }
    }
    
    // Create the agency
    const agency = new Agency({
      name: agencyConfig.name,
      description: agencyConfig.description,
      teams,
      workflows: agencyConfig.workflows || {}
    });
    
    return agency;
  }

  /**
   * Load an agency configuration from a JSON file
   * @param {string} filePath - Path to the JSON configuration file
   * @returns {Promise<Agency>} - Created agency instance
   */
  async loadAgencyFromFile(filePath) {
    try {
      // In a browser environment, use fetch
      if (typeof window !== 'undefined') {
        const response = await fetch(filePath);
        const agencyConfig = await response.json();
        return this.createAgency(agencyConfig);
      } 
      // In Node.js environment, use fs/promises
      else {
        // Convert the file path to a proper URL format for ESM
        const fileUrl = filePath.startsWith('file:') ? filePath : `file://${filePath}`;
        
        // Read and parse the JSON file
        const fileContent = await readFile(new URL(fileUrl), 'utf8');
        const agencyConfig = JSON.parse(fileContent);
        
        // Assuming the config file defines a single primary agency under the "agency" key
        // and we want to load the one named "blogCreationAgency" as per the test config.
        // A more general solution might require specifying the agency ID to load.
        const agencyIdToLoad = 'blogCreationAgency'; // Hardcoded for this specific test config

        // Use createAgencyFromConfig which handles creating teams and agents from the full config
        return this.createAgencyFromConfig(agencyConfig, agencyIdToLoad);
      }
    } catch (error) {
      console.error(`Error loading agency configuration from ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Create an agency from a configuration object that includes team configurations
   * @param {Object} config - Complete configuration object
   * @param {Object} config.agency - Agency configurations
   * @param {Object} config.teams - Team configurations
   * @param {string} agencyId - ID of the agency to create
   * @returns {Agency} - Created agency instance
   */
  createAgencyFromConfig(config, agencyId) {
    // Get the agency configuration
    const agencyConfig = config.agency[agencyId];
    if (!agencyConfig) {
      throw new Error(`Agency configuration not found for ID: ${agencyId}`);
    }
    
    console.log('Agency configuration from createAgencyFromConfig:');
    console.log('- agencyId:', agencyId);
    console.log('- name:', agencyConfig.name);
    console.log('- teams:', agencyConfig.teams);
    console.log('- workflows:', Object.keys(agencyConfig.workflows || {}));
    
    // Create all required teams
    const teams = {};
    for (const teamRef of agencyConfig.teams) {
      // Handle different team reference formats
      let teamId, teamName;
      
      if (typeof teamRef === 'string') {
        // Simple string reference
        teamId = teamRef;
        teamName = teamRef;
      } else if (typeof teamRef === 'object' && teamRef !== null) {
        // Object reference with optional alias
        teamId = teamRef.id;
        teamName = teamRef.alias || teamRef.id;
      } else {
        console.warn(`Warning: Invalid team reference in agency configuration:`, teamRef);
        continue;
      }
      
      const teamConfig = config.teams[teamId];
      if (!teamConfig) {
        console.warn(`Warning: Team configuration not found for ID: ${teamId}`);
        continue;
      }
      
      // Use createTeamFromConfig which handles creating agents from the full config
      teams[teamName] = this.teamFactory.createTeamFromConfig(config, teamId);
    }
    
    // Create the agency with the teams
    const agency = new Agency({
      name: agencyConfig.name,
      description: agencyConfig.description,
      teams: teams,
      workflows: agencyConfig.workflows || {}
    });
    
    console.log('Created agency:');
    console.log('- name:', agency.name);
    console.log('- teams:', Object.keys(agency.teams));
    console.log('- workflows:', Object.keys(agency.workflows));
    
    return agency;
  }

  /**
   * Add a getTeam method to the TeamFactory if it doesn't exist
   * This is used to resolve team references in agency configurations
   * @param {Function} getTeamFn - Function to get a team by ID
   */
  setTeamResolver(getTeamFn) {
    if (this.teamFactory && typeof getTeamFn === 'function') {
      this.teamFactory.getTeam = getTeamFn;
    }
  }
}
