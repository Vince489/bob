import * as math from 'mathjs';

// At module level
let memory = 0;
let previousResult = 0;

/**
 * Calculator tool that evaluates mathematical expressions using mathjs
 * @param {string} expression - The mathematical expression to evaluate (passed as { expression: "..." })
 * @returns {string} The result of the calculation
 */
async function execute({ expression }) { // Renamed to 'execute' and expect an object
  try {
    // Clean the expression
    const cleanExpression = expression.trim();

    // Handle special cases
    let processedExpression = cleanExpression;

    // Handle memory operations
    if (processedExpression.toUpperCase() === 'MS' || processedExpression.toLowerCase() === 'memory store') {
      memory = previousResult;
      return `Value ${memory} stored in memory`;
    }

    if (processedExpression.toUpperCase() === 'MR' || processedExpression.toLowerCase() === 'memory recall') {
      return memory.toString();
    }

    if (processedExpression.toUpperCase() === 'MC' || processedExpression.toLowerCase() === 'memory clear') {
      memory = 0;
      return 'Memory cleared';
    }

    // Replace "sine of X degrees" with sin(X deg)
    if (processedExpression.match(/sine of (\d+(\.\d+)?) degrees/i)) {
      processedExpression = processedExpression.replace(
        /sine of (\d+(\.\d+)?) degrees/i,
        'sin($1 deg)'
      );
    }

    // Handle natural language expressions
    if (processedExpression.match(/^(calculate|compute|evaluate|what is|find|solve)\s+/i)) {
      processedExpression = processedExpression.replace(
        /^(calculate|compute|evaluate|what is|find|solve)\s+/i,
        ''
      );
    }

    // Handle more mathematical phrases
    const mathTerms = {
      'square root of': 'sqrt',
      'cube root of': 'cbrt',
      'log base (\\d+(\\.\\d+)?) of (\\d+(\\.\\d+)?)': (match) => `log(${match[2]}, ${match[1]})`, // Use function for replacement
      'factorial of': 'factorial',
      'percent of': '* 0.01 *',
      'to the power of': '^'
    };

    Object.entries(mathTerms).forEach(([pattern, replacement]) => {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(processedExpression)) {
        if (typeof replacement === 'function') {
            processedExpression = processedExpression.replace(regex, replacement);
        } else if (replacement === 'sqrt' || replacement === 'cbrt' || replacement === 'factorial') {
          const numberMatch = processedExpression.match(new RegExp(`${pattern}\\s*(\\d+(\\.\\d+)?)`, 'i'));
          if (numberMatch && numberMatch[1]) {
            processedExpression = processedExpression.replace(
              new RegExp(`${pattern}\\s*(\\d+(\\.\\d+)?)`, 'i'),
              `${replacement}(${numberMatch[1]})`
            );
          }
        } else {
           processedExpression = processedExpression.replace(regex, replacement);
        }
      }
    });
    
    // Handle unit conversions
    const unitConversionMatch = processedExpression.match(/convert\s+([\d.]+)\s*([a-zA-Z]+)\s+to\s+([a-zA-Z]+)/i);
    if (unitConversionMatch) {
      const value = unitConversionMatch[1];
      const fromUnit = unitConversionMatch[2];
      const toUnit = unitConversionMatch[3];
      processedExpression = `${value} ${fromUnit} to ${toUnit}`;
    }

    // Handle rounding requests
    const roundingMatch = processedExpression.match(/round\s+([\d.]+)\s+to\s+(\d+)\s+decimal places/i);
    if (roundingMatch) {
      const number = parseFloat(roundingMatch[1]);
      const places = parseInt(roundingMatch[2]);
      const result = (Math.round(number * Math.pow(10, places)) / Math.pow(10, places));
      previousResult = result;
      return result.toString();
    }

    // Evaluate the expression using mathjs
    console.log(`   Evaluating with mathjs: "${processedExpression}"`);
    const result = math.evaluate(processedExpression);

    previousResult = result;

    if (math.typeOf(result) === 'Complex') {
      return `${result.toString()}`;
    } else if (math.typeOf(result) === 'BigNumber') {
      return result.toString();
    } else if (Array.isArray(result)) {
      return JSON.stringify(result);
    } else if (typeof result === 'object' && result !== null && typeof result.toString === 'function' && !result.isUnit) {
        // Check for mathjs result objects that are not units
        return JSON.stringify(result);
    } else if (result && typeof result.toString === 'function') { // Handles units and numbers
        return result.toString();
    }


    // Handle floating-point precision issues for trigonometric functions
    if (typeof result === 'number' && (processedExpression.includes('sin') ||
        processedExpression.includes('cos') ||
        processedExpression.includes('tan') ||
        cleanExpression.includes('sine of'))) {
      const roundedResult = Math.round(result * 1e10) / 1e10;
      if (Math.abs(roundedResult - 0.5) < 1e-10) return '0.5';
      if (Math.abs(roundedResult - 1) < 1e-10) return '1';
      if (Math.abs(roundedResult - 0) < 1e-10) return '0';
      return roundedResult.toString();
    }
    
    return String(result); // Ensure it's always a string

  } catch (error) {
    console.error(`   Calculator tool error: ${error.message} for expression "${expression}" (processed: "${processedExpression}")`);
    if (error.message.includes('Undefined symbol')) {
      const symbolMatch = error.message.match(/Undefined symbol\s+(\w+)/);
      const symbol = symbolMatch ? symbolMatch[1] : "unknown";
      return `Error: '${symbol}' is not recognized. Did you mean to use a supported function like sin(), cos(), sqrt()?`;
    } else if (error.message.includes('Unexpected token')) {
      return `Error: Your expression has syntax errors. Please check for missing parentheses or operators.`;
    }
    return `Calculator error: ${error.message}`;
  }
}

/**
 * Provides metadata about the calculator tool for LLM agent integration
 */
function describeCalculatorTool() {
  return {
    name: "calculatorTool", // Ensure name matches filename for loader
    description: "Evaluates mathematical expressions and performs calculations including basic arithmetic, trigonometric functions, unit conversions, and memory operations (MS, MR, MC). Handles natural language queries for calculations.",
    inputSchema: { // This is the 'inputSchema' the factory expects
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "The mathematical expression to evaluate. Examples: '2+2', 'sin(30 deg)', 'square root of 16', 'convert 5 km to miles', 'MS' (to store last result), 'MR' (to recall stored value)."
        }
      },
      required: ["expression"]
    },
    // The 'usage', 'parameters', 'examples', 'capabilities' from your describe function
    // are good for documentation but not directly used by the current LLMProcessor's prompt.
    // The LLMProcessor uses 'description' and 'inputSchema'.
    // We can keep them for future enhancements or documentation generation.
    usage_docs: "Use by writing [TOOL: calculator(your expression here)]", // Renamed to avoid conflict
    parameters_docs: { /* ... */ }, // Renamed
    examples_docs: [ /* ... */ ],   // Renamed
    capabilities_docs: [ /* ... */ ] // Renamed
  };
}

// Combine execute function with metadata for the export
export const calculatorTool = {
  execute,
  ...describeCalculatorTool() // Spread the metadata
};
