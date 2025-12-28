/**
 * MCP Integration Tests
 *
 * Tests that agent.js can successfully:
 * 1. Initialize the MCP server
 * 2. Call each MCP tool
 * 3. Handle errors gracefully
 */

import 'dotenv/config';
import { initializeMCP, shutdownMCP, handleFunctionCall } from '../src/agent.js';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

interface Results {
  passed: number;
  failed: number;
  tests: TestResult[];
}

// Test results tracking
const results: Results = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name: string, passed: boolean, message: string = ''): void {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}`);
  if (message) console.log(`   ${message}`);

  results.tests.push({ name, passed, message });
  if (passed) results.passed++;
  else results.failed++;
}

async function runTests() {
  console.log('\n🧪 Running MCP Integration Tests...\n');
  console.log('═'.repeat(60));

  try {
    // Test 1: MCP Initialization
    console.log('\n📡 Test 1: MCP Server Initialization');
    console.log('─'.repeat(60));

    let mcpClient;
    try {
      mcpClient = await initializeMCP();
      logTest('MCP server starts successfully', !!mcpClient);
    } catch (error) {
      logTest('MCP server starts successfully', false, error.message);
      throw error; // Can't continue without MCP
    }

    // Test 2: Log Sleep
    console.log('\n😴 Test 2: Log Sleep Function');
    console.log('─'.repeat(60));

    try {
      const result = await handleFunctionCall(
        'logSleep',
        { duration_minutes: 90, notes: 'Test sleep session' },
        '+15555551234',
        null
      );

      logTest('logSleep returns success', result.success === true);
      logTest('logSleep returns message', !!result.message);
      console.log(`   Response: ${result.message}`);
    } catch (error) {
      logTest('logSleep executes', false, error.message);
    }

    // Test 3: Log Feeding
    console.log('\n🍼 Test 3: Log Feeding Function');
    console.log('─'.repeat(60));

    try {
      const result = await handleFunctionCall(
        'logFeeding',
        { amount_oz: 4, notes: 'Test bottle feeding' },
        '+15555551234',
        null
      );

      logTest('logFeeding returns success', result.success === true);
      logTest('logFeeding returns message', !!result.message);
      console.log(`   Response: ${result.message}`);
    } catch (error) {
      logTest('logFeeding executes', false, error.message);
    }

    // Test 4: Log Diaper
    console.log('\n🚼 Test 4: Log Diaper Function');
    console.log('─'.repeat(60));

    try {
      const result = await handleFunctionCall(
        'logDiaper',
        { mode: 'pee', notes: 'Test diaper change' },
        '+15555551234',
        null
      );

      logTest('logDiaper returns success', result.success === true);
      logTest('logDiaper returns message', !!result.message);
      console.log(`   Response: ${result.message}`);
    } catch (error) {
      logTest('logDiaper executes', false, error.message);
    }

    // Test 5: Log Activity
    console.log('\n🎈 Test 5: Log Activity Function');
    console.log('─'.repeat(60));

    try {
      const result = await handleFunctionCall(
        'logActivity',
        { activity: 'burp', notes: 'Test burp activity' },
        '+15555551234',
        null
      );

      logTest('logActivity returns success', result.success === true);
      logTest('logActivity returns message', !!result.message);
      console.log(`   Response: ${result.message}`);
    } catch (error) {
      logTest('logActivity executes', false, error.message);
    }

    // Test 6: Record Update (local, not MCP)
    console.log('\n📝 Test 6: Record Update Function');
    console.log('─'.repeat(60));

    try {
      const mockSaveFunction = (phone, update, category) => {
        console.log(`   Mock save: ${category} - ${update}`);
      };

      const result = await handleFunctionCall(
        'recordUpdate',
        { update: 'Test milestone', category: 'milestone' },
        '+15555551234',
        mockSaveFunction
      );

      logTest('recordUpdate returns success', result.success === true);
      logTest('recordUpdate returns message', !!result.message);
      console.log(`   Response: ${result.message}`);
    } catch (error) {
      logTest('recordUpdate executes', false, error.message);
    }

    // Test 7: Error Handling
    console.log('\n⚠️  Test 7: Error Handling');
    console.log('─'.repeat(60));

    try {
      const result = await handleFunctionCall(
        'unknownFunction',
        {},
        '+15555551234',
        null
      );

      logTest('Unknown function returns error', result.success === false);
      logTest('Unknown function returns error message', !!result.message);
      console.log(`   Response: ${result.message}`);
    } catch (error) {
      logTest('Error handling works', false, error.message);
    }

  } catch (error) {
    console.error('\n❌ Critical test failure:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await shutdownMCP();
  }

  // Print summary
  console.log('\n' + '═'.repeat(60));
  console.log('\n📊 Test Summary');
  console.log('─'.repeat(60));
  console.log(`Total Tests: ${results.passed + results.failed}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

  if (results.failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.tests
      .filter(t => !t.passed)
      .forEach(t => console.log(`   - ${t.name}: ${t.message}`));
  }

  console.log('\n' + '═'.repeat(60) + '\n');

  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
