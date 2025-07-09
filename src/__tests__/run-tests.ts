/**
 * Test runner script for development and CI
 */

import { spawn } from 'child_process';
import { resolve } from 'path';

interface TestRunOptions {
  watch?: boolean;
  coverage?: boolean;
  verbose?: boolean;
  testPattern?: string;
  maxWorkers?: number;
  ui?: boolean;
}

/**
 * Run Vitest tests with specified options
 */
function runTests(options: TestRunOptions = {}): Promise<number> {
  return new Promise((resolve, reject) => {
    const vitestArgs: string[] = [];

    // Add options
    if (options.watch) {
      vitestArgs.push('--watch');
    } else {
      vitestArgs.push('run');
    }

    if (options.coverage) {
      vitestArgs.push('--coverage');
    }

    if (options.verbose) {
      vitestArgs.push('--verbose');
    }

    if (options.testPattern) {
      vitestArgs.push('--testNamePattern', options.testPattern);
    }

    if (options.maxWorkers) {
      vitestArgs.push('--threads', options.maxWorkers.toString());
    }

    if (options.ui) {
      vitestArgs.push('--ui');
    }

    // Force colors in CI
    if (process.env.CI) {
      vitestArgs.push('--reporter=verbose');
    }

    console.log('Running tests with Vitest...');
    console.log('Command: npx vitest', vitestArgs.join(' '));

    const vitest = spawn('npx', ['vitest', ...vitestArgs], {
      stdio: 'inherit',
      shell: true,
      cwd: process.cwd(),
    });

    vitest.on('close', (code) => {
      if (code === 0) {
        console.log('✅ All tests passed!');
        resolve(0);
      } else {
        console.log(`❌ Tests failed with exit code ${code}`);
        resolve(code || 1);
      }
    });

    vitest.on('error', (error) => {
      console.error('❌ Failed to start Vitest:', error);
      reject(error);
    });
  });
}

/**
 * Parse command line arguments
 */
function parseArgs(): TestRunOptions {
  const args = process.argv.slice(2);
  const options: TestRunOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--watch':
      case '-w':
        options.watch = true;
        break;

      case '--coverage':
      case '-c':
        options.coverage = true;
        break;

      case '--verbose':
      case '-v':
        options.verbose = true;
        break;

      case '--pattern':
      case '-p':
        options.testPattern = args[++i];
        break;

      case '--max-workers':
      case '--threads':
        options.maxWorkers = parseInt(args[++i], 10);
        break;

      case '--ui':
        options.ui = true;
        break;

      case '--help':
      case '-h':
        console.log(`
Test Runner for Stampchain MCP Server

Usage: npm run test [options]

Options:
  --watch, -w         Run tests in watch mode
  --coverage, -c      Generate test coverage report
  --verbose, -v       Show verbose test output
  --pattern, -p       Run tests matching pattern
  --threads           Number of worker threads
  --ui                Open Vitest UI
  --help, -h          Show this help message

Examples:
  npm run test                    Run all tests once
  npm run test -- --watch        Run tests in watch mode
  npm run test -- --coverage     Run tests with coverage
  npm run test -- --pattern api  Run only API tests
  npm run test -- --ui           Open Vitest UI
`);
        process.exit(0);
        break;
    }
  }

  return options;
}

/**
 * Main function
 */
async function main() {
  try {
    const options = parseArgs();
    const exitCode = await runTests(options);
    process.exit(exitCode);
  } catch (error) {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { runTests, parseArgs };
