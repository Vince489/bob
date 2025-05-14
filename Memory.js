import { EventEmitter } from './utils/EventEmitter.js'; // Import from utils

export class Memory {
    constructor(maxEntries = 10) {
      this.entries = []; // For conversational history
      this.maxEntries = maxEntries;
      this.keyValueStore = {}; // For generic key-value storage
      this.events = new EventEmitter(); // Instantiate emitter
    }

    // --- Conversational History Methods ---

    add(input, response) {
      this.entries.push({
        input,
        response,
        timestamp: new Date()
      });

      // Keep only the most recent entries to avoid context getting too large
      if (this.entries.length > this.maxEntries) {
        this.entries = this.entries.slice(-this.maxEntries);
      }
      // Emit event after adding and trimming
      this.events.emit('historyUpdated', this.entries);
    }

    getAll() { // Gets conversational entries
      return this.entries;
    }

    // Get conversation history as a formatted string for context
    getConversationHistory() {
      if (this.entries.length === 0) return '';

      let history = '\n\nPrevious conversation:\n';

      this.entries.forEach(entry => {
        history += `User: ${entry.input}\n`;
        history += `Assistant: ${entry.response}\n\n`;
      });

      return history;
    }

    // --- Generic Key-Value Store Methods ---

    /**
     * Store a key-value pair.
     * @param {string} key - The key to store.
     * @param {*} value - The value to store.
     */
    remember(key, value) {
      this.keyValueStore[key] = value;
      this.events.emit('keyValueUpdated', { key, value, store: this.keyValueStore });
    }

    /**
     * Recall a value by its key.
     * @param {string} key - The key to recall.
     * @returns {*} - The stored value, or undefined if the key doesn't exist.
     */
    recall(key) {
      return this.keyValueStore[key];
    }

    /**
     * Forget a key-value pair.
     * @param {string} key - The key to forget.
     */
    forget(key) {
      if (Object.hasOwnProperty.call(this.keyValueStore, key)) {
        delete this.keyValueStore[key];
        this.events.emit('keyValueRemoved', { key, store: this.keyValueStore });
      }
    }

    /**
     * Get all key-value pairs.
     * @returns {Object} - All stored key-value pairs.
     */
    getAllKeyValuePairs() {
      return { ...this.keyValueStore };
    }


    // --- Event Methods ---

    /**
     * Subscribe to memory events
     * @param {string} eventName - Event name to subscribe to ('historyUpdated')
     * @param {Function} listener - Function to call when event is emitted
     * @returns {Function} - Unsubscribe function
     */
    on(eventName, listener) {
      return this.events.on(eventName, listener);
    }

    /**
     * Unsubscribe from memory events
     * @param {string} eventName - Event name to unsubscribe from
     * @param {Function} listenerToRemove - Listener function to remove
     */
    off(eventName, listenerToRemove) {
      this.events.off(eventName, listenerToRemove);
    }

    /**
     * Subscribe to a memory event for a single occurrence
     * @param {string} eventName - Event name to subscribe to
     * @param {Function} listener - Function to call when the event is emitted
     */
    once(eventName, listener) {
      this.events.once(eventName, listener);
    }

    // Note: Direct emit is usually internal, but could be exposed if needed
    // emit(eventName, data) {
    //   this.events.emit(eventName, data);
    // }
  }
