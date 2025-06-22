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
}

/**
 * Run Jest tests with specified options
 */
function runTests(options: TestRunOptions = {}): Promise<number> {
  return new Promise((resolve, reject) => {
    const jestArgs = ['--config', 'jest.config.js'];

    // Add options
    if (options.watch) {
      jestArgs.push('--watch');
    }
    
    if (options.coverage) {
      jestArgs.push('--coverage');
    }
    
    if (options.verbose) {
      jestArgs.push('--verbose');
    }
    
    if (options.testPattern) {
      jestArgs.push('--testNamePattern', options.testPattern);
    }
    
    if (options.maxWorkers) {
      jestArgs.push('--maxWorkers', options.maxWorkers.toString());
    }

    // Force colors in CI
    if (process.env.CI) {
      jestArgs.push('--colors');
    }

    console.log('Running tests with Jest...');
    console.log('Command: npx jest', jestArgs.join(' '));

    const jest = spawn('npx', ['jest', ...jestArgs], {
      stdio: 'inherit',
      shell: true,
      cwd: process.cwd(),
    });

    jest.on('close', (code) => {
      if (code === 0) {
        console.log('✅ All tests passed!');
        resolve(0);
      } else {
        console.log(`❌ Tests failed with exit code ${code}`);
        resolve(code || 1);
      }
    });

    jest.on('error', (error) => {
      console.error('❌ Failed to start Jest:', error);
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
        options.maxWorkers = parseInt(args[++i], 10);
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
  --max-workers       Number of worker processes
  --help, -h          Show this help message

Examples:
  npm run test                    Run all tests once
  npm run test -- --watch        Run tests in watch mode
  npm run test -- --coverage     Run tests with coverage
  npm run test -- --pattern api  Run only API tests
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