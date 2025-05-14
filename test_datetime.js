// test_datetime.js
import { dateTimeTool } from './tools/datetime.js';

async function runTests() {
  console.log("Running datetime tests...");

  // Test 1: Get current date and time
  let result1 = await dateTimeTool('now');
  console.log("Test 1 (now):", result1);
  if (!result1.includes("Current date and time")) {
    console.error("Test 1 failed");
  }

  // Test 2: Get current date and time in a specific timezone
  let result2 = await dateTimeTool('now America/Los_Angeles');
  console.log("Test 2 (now America/Los_Angeles):", result2);
  if (!result2.includes("Current date and time") || !result2.includes("America/Los_Angeles")) {
    console.error("Test 2 failed");
  }

  // Test 3: Format date
  let result3 = await dateTimeTool('format 2024-01-15 yyyy-MM-dd');
  console.log("Test 3 (format):", result3);
  if (!result3.includes("2024-01-15")) {
    console.error("Test 3 failed");
  }

  // Test 4: Add time
  let result4 = await dateTimeTool('add now 1 days');
  console.log("Test 4 (add):", result4);
  if (!result4.includes("days")) {
    console.error("Test 4 failed");
  }

  // Test 5: Subtract time
  let result5 = await dateTimeTool('subtract now 1 days');
  console.log("Test 5 (subtract):", result5);
  if (!result5.includes("days")) {
    console.error("Test 5 failed");
  }

  // Test 6: Difference between dates
  let result6 = await dateTimeTool('diff 2024-01-01 2024-01-10 days');
  console.log("Test 6 (diff):", result6);
  if (!result6.includes("9 days")) {
    console.error("Test 6 failed");
  }

  // Test 7: Timezone conversion
  let result7 = await dateTimeTool('timezone convert 2024-01-01T12:00:00 America/New_York Asia/Tokyo');
  console.log("Test 7 (timezone convert):", result7);
  if (!result7.includes("Asia/Tokyo")) {
    console.error("Test 7 failed");
  }

  // Test 8: Day of the week
  let result8 = await dateTimeTool('dayofweek 2024-05-14');
  console.log("Test 8 (dayofweek):", result8);
  if (!result8.includes("Tuesday")) {
    console.error("Test 8 failed");
  }

  // Test 9: Complex date calculation
  let result9 = await dateTimeTool('what date will it be 1 months and 10 days from today');
  console.log("Test 9 (complex date calculation):", result9);
  const expectedDate = "June 24, 2025";
  if (!result9.includes(expectedDate)) {
    console.error("Test 9 failed");
  }

  console.log("All tests complete.");
}

runTests();
