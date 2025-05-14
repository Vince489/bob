import { DateTime } from 'luxon';

/**
 * Date/Time Tool for LLM/Agent using Luxon
 */
class DateTimeTool {
  constructor() {
    this.name = 'datetime_tool';
    this.description = 'Provides current date and time, and can perform date/time calculations and conversions.';
  }

  /**
   * Gets the current date and time.
   * @param {string} location - The location for which to retrieve the date and time (e.g., 'America/New_York', 'Europe/London', 'Asia/Tokyo',  or a specific city).  If not provided, defaults to the user's local time.
   * @returns {string} - The current date and time in ISO format, or an error message.
   */
  getCurrentDateTime(location) {
      try {
        let dt;
        if (location) {
          dt = DateTime.now().setZone(location);
        } else {
          dt = DateTime.now();
        }
        return dt.toISO();
      } catch (error) {
          return `Error: Invalid location: ${location}.  Please specify a valid IANA time zone (e.g., 'America/New_York') or a city.`;
      }
  }

    /**
     * Converts a date/time to a different time zone.
     * @param {string} dateTimeStr - The date/time string to convert (in ISO format).
     * @param {string} targetTimeZone - The target time zone (e.g., 'America/Los_Angeles').
     * @returns {string} - The converted date/time string in ISO format, or an error.
     */
    convertToTimeZone(dateTimeStr, targetTimeZone) {
        try {
            const dt = DateTime.fromISO(dateTimeStr).setZone(targetTimeZone);
            return dt.toISO();
        } catch (error) {
            return `Error: Could not convert ${dateTimeStr} to time zone ${targetTimeZone}.  ${error}`;
        }
    }


  /**
   * Formats a date/time string.
   * @param {string} dateTimeStr - The date/time string to format (in ISO format).
   * @param {string} format - The desired format (e.g., 'yyyy-MM-dd HH:mm:ss', 'MMMM dd, yyyy', 'h:mm a').  See https://moment.github.io/luxon/#/formatting for format options.
   * @returns {string} - The formatted date/time string, or an error message.
   */
  formatDateTime(dateTimeStr, format) {
    try {
      const dt = DateTime.fromISO(dateTimeStr);
      return dt.toFormat(format);
    } catch (error) {
      return `Error: Invalid date/time string or format: ${dateTimeStr}, ${format}. ${error}`;
    }
  }

  /**
   * Calculates the difference between two date/time values.
   * @param {string} startDateTimeStr - The starting date/time string (in ISO format).
   * @param {string} endDateTimeStr - The ending date/time string (in ISO format).
   * @param {string} unit - The unit of time for the difference (e.g., 'years', 'months', 'days', 'hours', 'minutes', 'seconds').
   * @returns {number|string} - The difference between the two date/time values in the specified unit, or an error message.
   */
  dateTimeDifference(startDateTimeStr, endDateTimeStr, unit) {
    try {
      const startDt = DateTime.fromISO(startDateTimeStr);
      const endDt = DateTime.fromISO(endDateTimeStr);

      const diff = endDt.diff(startDt, unit);
      return diff.toObject()[unit]; // Extract the value of the specified unit
    } catch (error) {
      return `Error: Invalid date/time string or unit: ${startDateTimeStr}, ${endDateTimeStr}, ${unit}. ${error}`;
    }
  }

    /**
     * Adds a specified amount of time to a date/time.
     * @param {string} dateTimeStr - The date/time string to add to (in ISO format).
     * @param {number} amount - The amount of time to add.
     * @param {string} unit - The unit of time to add (e.g., 'years', 'months', 'days', 'hours', 'minutes', 'seconds').
     * @returns {string} The resulting date/time string in ISO format, or an error.
     */
    addTimeToDateTime(dateTimeStr, amount, unit) {
        try {
            const dt = DateTime.fromISO(dateTimeStr).plus({ [unit]: amount });
            return dt.toISO();
        } catch (error) {
             return `Error: Could not add ${amount} ${unit} to ${dateTimeStr}. ${error}`;
        }
    }

    /**
     * Subtracts a specified amount of time from a date/time.
     * @param {string} dateTimeStr - The date/time string to subtract from (in ISO format).
     * @param {number} amount - The amount of time to subtract.
     * @param {string} unit - The unit of time to subtract (e.g., 'years', 'months', 'days', 'hours', 'minutes', 'seconds').
     * @returns {string} The resulting date/time string in ISO format, or an error.
     */
    subtractTimeFromDateTime(dateTimeStr, amount, unit) {
        try {
            const dt = DateTime.fromISO(dateTimeStr).minus({ [unit]: amount });
            return dt.toISO();
        } catch (error) {
            return `Error: Could not subtract ${amount} ${unit} from ${dateTimeStr}. ${error}`;
        }
    }


  /**
   * Parses a date/time string into a Luxon DateTime object.  Useful for more complex operations.
   * @param {string} dateTimeStr - The date/time string to parse.
   * @param {string} format - Optional format string if the date/time string is not in ISO format.
   * @returns {DateTime|string} - A Luxon DateTime object, or an error message.
   */
  parseDateTime(dateTimeStr, format) {
    try {
        let dt;
        if (format) {
          dt = DateTime.fromFormat(dateTimeStr, format);
        }
        else{
          dt = DateTime.fromISO(dateTimeStr)
        }
      return dt;
    } catch (error) {
      return `Error: Could not parse date/time string: ${dateTimeStr} with format ${format}. ${error}`;
    }
  }

  // No example usage in production code - see test-datetime-agent.js for usage examples
}

// See test-datetime-agent.js for usage examples

/**
 * Date/Time Tool function for use with the Agent class
 * @param {string} input - The input string containing the command and parameters
 * @returns {Promise<any>} - The result of the date/time operation
 */
export const dateTimeTool = async (input) => {
  const tool = new DateTimeTool();

  // Pre-process the input to handle common natural language patterns
  let processedInput = input.trim();

  // Handle timezone queries with special format
  if (processedInput.includes('timezone=')) {
    const match = processedInput.match(/now,\s*timezone="([^"]+)"/i);
    if (match) {
      processedInput = `now ${match[1]}`;
    }
  }

  // Handle city-based timezone queries
  if (processedInput.match(/now,\s*city=(\w+)/i)) {
    const match = processedInput.match(/now,\s*city=(\w+)/i);
    if (match) {
      const city = match[1];
      // Map common cities to IANA timezone names
      const cityToTimezone = {
        'Paris': 'Europe/Paris',
        'London': 'Europe/London',
        'Tokyo': 'Asia/Tokyo',
        'NewYork': 'America/New_York',
        'LosAngeles': 'America/Los_Angeles'
      };
      const timezone = cityToTimezone[city] || city;
      processedInput = `now ${timezone}`;
    }
  }

  // Handle time conversion queries
  if (processedInput.match(/(\d{1,2}):(\d{2})\s+(AM|PM)?\s+in\s+(\w+)/i) ||
      processedInput.match(/convert\s+(\d{1,2}):(\d{2})/i)) {
    const timeMatch = processedInput.match(/(\d{1,2}):(\d{2})\s+(AM|PM)?/i);
    const fromZoneMatch = processedInput.match(/from\s+(\w+\/\w+)/i) || processedInput.match(/in\s+(\w+)/i);
    const toZoneMatch = processedInput.match(/to\s+(\w+\/\w+)/i);

    if (timeMatch) {
      let hour = parseInt(timeMatch[1], 10);
      const minute = parseInt(timeMatch[2], 10);
      const ampm = timeMatch[3]?.toUpperCase();

      // Convert to 24-hour format if AM/PM is specified
      if (ampm === 'PM' && hour < 12) hour += 12;
      if (ampm === 'AM' && hour === 12) hour = 0;

      // Create a date string with today's date and the specified time
      const today = DateTime.now().toFormat('yyyy-MM-dd');
      const timeStr = `${today}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;

      const fromZone = fromZoneMatch ? fromZoneMatch[1] : 'America/New_York'; // Default from zone
      const toZone = toZoneMatch ? toZoneMatch[1] : 'Asia/Tokyo'; // Default to zone

      processedInput = `timezone convert ${timeStr} ${fromZone} ${toZone}`;
    }
  }

  // Handle day of week queries
  if (processedInput.toLowerCase().includes('day of the week')) {
    const dateMatch = processedInput.match(/(\w+ \d{1,2},? \d{4})|(\d{4}-\d{2}-\d{2})/i);
    if (dateMatch) {
      const dateStr = dateMatch[0];
      processedInput = `format ${dateStr} EEEE`;
    }
  }

  // Handle complex date calculations
  const complexDateRegex1 = /(\d+)\s+months\s+and\s+(\d+)\s+days/i;
  const complexDateRegex2 = /what date will it be (\d+) months and (\d+) days from today/i;
  const complexDateRegex3 = /add now (\d+) months (\d+) days/i;

  if (processedInput.match(complexDateRegex1) || processedInput.match(complexDateRegex2) || processedInput.match(complexDateRegex3)) {
    const match = processedInput.match(complexDateRegex1) || processedInput.match(complexDateRegex2) || processedInput.match(complexDateRegex3);
    if (match) {
      const months = parseInt(match[1], 10);
      const days = parseInt(match[2], 10);

      // First add months
      let currentDate = tool.getCurrentDateTime();
      currentDate = tool.addTimeToDateTime(currentDate, months, 'months');

      // Then add days
      processedInput = `add ${currentDate} ${days} days`;
    }
  }

  // Parse the processed input
  const parts = processedInput.split(' ');
  const command = parts[0].toLowerCase();

  try {
    // Handle different commands
    switch (command) {
      case 'now':
        // Get current date and time, optionally in a specific timezone
        const location = parts.length > 1 ? parts.slice(1).join(' ') : null;

        try {
          // Get the current date/time in the specified timezone
          let dt;
          if (location) {
            dt = DateTime.now().setZone(location);
          } else {
            dt = DateTime.now();
          }

          // Format it with the timezone name
          const formattedNow = dt.toFormat('MMMM d, yyyy h:mm:ss a ZZZZ');

          return `Current date and time${location ? ` in ${location}` : ''}: ${formattedNow}`;
        } catch (error) {
          return `Error: Invalid location: ${location}. Please specify a valid IANA time zone (e.g., 'America/New_York') or a city.`;
        }

      case 'format':
        // Format a date/time string
        if (parts.length < 3) {
          return `Error: Format command requires a date and format string`;
        }
        const dateStr = parts[1];
        const format = parts.slice(2).join(' ');
        const formatResult = tool.formatDateTime(dateStr, format);
        return formatResult;

      case 'add':
        // Add time to a date
        if (parts.length < 4) {
          return `Error: Add command requires a date, amount, and unit`;
        }
        let addDateStr = parts[1];
        const addAmount = parseInt(parts[2], 10);
        const addUnit = parts[3];

        // Handle special case for "now"
        if (addDateStr.toLowerCase() === 'now') {
          addDateStr = tool.getCurrentDateTime();
        }

        const addResult = tool.addTimeToDateTime(addDateStr, addAmount, addUnit);
        // Format the result in a more readable way if it's a valid date
        let addFormattedResult = addResult;
        if (!addResult.startsWith('Error')) {
          try {
            const dt = DateTime.fromISO(addResult);
            addFormattedResult = dt.toFormat('MMMM d, yyyy') + ' (' + addResult + ')';
          } catch (e) {
            // If formatting fails, use the original result
          }
        }
        return `${parts[1]} + ${addAmount} ${addUnit} = ${addFormattedResult}`;

      case 'subtract':
      case 'sub':
        // Subtract time from a date
        if (parts.length < 4) {
          return `Error: Subtract command requires a date, amount, and unit`;
        }
        let subDateStr = parts[1];
        const subAmount = parseInt(parts[2], 10);
        const subUnit = parts[3];

        // Handle special case for "now"
        if (subDateStr.toLowerCase() === 'now') {
          subDateStr = tool.getCurrentDateTime();
        }

        const subResult = tool.subtractTimeFromDateTime(subDateStr, subAmount, subUnit);
        // Format the result in a more readable way if it's a valid date
        let subFormattedResult = subResult;
        if (!subResult.startsWith('Error')) {
          try {
            const dt = DateTime.fromISO(subResult);
            subFormattedResult = dt.toFormat('MMMM d, yyyy') + ' (' + subResult + ')';
          } catch (e) {
            // If formatting fails, use the original result
          }
        }
        return `${parts[1]} - ${subAmount} ${subUnit} = ${subFormattedResult}`;

      case 'diff':
      case 'difference':
        // Calculate difference between dates
        if (parts.length < 3) {
          return `Error: Diff command requires two dates and optionally a unit`;
        }
        const startDate = parts[1];
        const endDate = parts[2];
        const diffUnit = parts.length > 3 ? parts[3] : 'days';
        const diffResult = tool.dateTimeDifference(startDate, endDate, diffUnit);
        return `Difference between ${startDate} and ${endDate}: ${diffResult} ${diffUnit}`;

      case 'timezone':
      case 'tz':
        // Convert between timezones
        if (parts.length < 4) {
          return `Error: Timezone command format: timezone convert [date] [fromTZ] [toTZ]`;
        }

        if (parts[1] === 'convert') {
          const tzDateStr = parts[2];
          const fromTZ = parts.length > 4 ? parts[3] : null;
          const toTZ = parts.length > 4 ? parts[4] : parts[3];

          // If we have both from and to timezones
          if (fromTZ && toTZ) {
            // First convert the time to ISO in the from timezone
            let dateInFromTZ;
            if (tzDateStr.includes('T')) {
              // Already in ISO format
              dateInFromTZ = tzDateStr;
            } else {
              // Create a datetime with the time in the from timezone
              const now = DateTime.now().setZone(fromTZ);
              const [hours, minutes] = tzDateStr.split(':').map(n => parseInt(n, 10));
              dateInFromTZ = now.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 }).toISO();
            }

            // Then convert to the target timezone
            const tzResult = tool.convertToTimeZone(dateInFromTZ, toTZ);

            // Format the result
            let formattedTzResult = tzResult;
            try {
              const dt = DateTime.fromISO(tzResult);
              formattedTzResult = dt.toFormat('h:mm a') + ' on ' + dt.toFormat('MMMM d, yyyy') + ' (' + tzResult + ')';
            } catch (e) {
              // If formatting fails, use the original result
            }

            return `${tzDateStr} in ${fromTZ} is ${formattedTzResult} in ${toTZ}`;
          } else {
            // Just one timezone specified, assume it's the target
            const tzResult = tool.convertToTimeZone(tzDateStr, toTZ);
            return `${tzDateStr} in ${toTZ}: ${tzResult}`;
          }
        }
        return `Error: Unknown timezone command: ${parts[1]}. Use 'timezone convert'.`;

      case 'dayofweek':
        // Get the day of the week for a date
        if (parts.length < 2) {
          return `Error: dayofweek command requires a date`;
        }
        const dowDateStr = parts[1];
        return tool.formatDateTime(dowDateStr, 'EEEE');

      case 'help':
        // Return help information
        return `
Available DateTime Tool Commands:
- now [timezone] - Get current date/time, optionally in a specific timezone
- format [date] [format] - Format a date using Luxon format strings
- add [date] [amount] [unit] - Add time to a date
- subtract [date] [amount] [unit] - Subtract time from a date
- diff [startDate] [endDate] [unit] - Calculate difference between dates
- timezone convert [date] [fromTZ] [toTZ] - Convert date between timezones
- dayofweek [date] - Get the day of the week for a date
- help - Show this help information
`;

      default:
        // Try to interpret as a date for formatting
        try {
          const dt = DateTime.fromISO(command);
          if (dt.isValid) {
            return dt.toFormat('EEEE, MMMM d, yyyy');
          }
        } catch (e) {
          // Not a valid date, continue to error
        }

        return `Error: Unknown command: ${command}. Use 'help' to see available commands.`;
    }
  } catch (error) {
    return `Error processing command: ${error.message}`;
  }
};

// Export both the class and the function
export default DateTimeTool;
