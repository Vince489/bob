/**
 * Event System Utility
 * Provides basic publish/subscribe functionality.
 */
export class EventEmitter {
  constructor() {
    this.events = {};
  }

  /**
   * Subscribe to an event
   * @param {string} eventName - Name of the event to subscribe to
   * @param {Function} listener - Function to call when the event is emitted
   * @returns {Function} - Unsubscribe function
   */
  on(eventName, listener) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(listener);
    // Return unsubscribe function
    return () => this.off(eventName, listener);
  }

  /**
   * Unsubscribe from an event
   * @param {string} eventName - Name of the event to unsubscribe from
   * @param {Function} listenerToRemove - Listener function to remove
   */
  off(eventName, listenerToRemove) {
    if (!this.events[eventName]) return;
    this.events[eventName] = this.events[eventName].filter(
      listener => listener !== listenerToRemove
    );
  }

  /**
   * Emit an event
   * @param {string} eventName - Name of the event to emit
   * @param {*} data - Data to pass to the listeners
   */
  emit(eventName, data) {
    if (!this.events[eventName]) return;
    // Use slice to prevent issues if a listener unsubscribes during iteration
    const listeners = this.events[eventName].slice(); 
    listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in event listener for ${eventName}:`, error);
      }
    });
  }

  /**
   * Subscribe to an event for a single occurrence
   * @param {string} eventName - Name of the event to subscribe to
   * @param {Function} listener - Function to call when the event is emitted
   */
  once(eventName, listener) {
    const onceWrapper = (data) => {
      listener(data);
      this.off(eventName, onceWrapper);
    };
    // Store the original listener for potential removal by reference
    onceWrapper.originalListener = listener; 
    return this.on(eventName, onceWrapper);
  }
}
