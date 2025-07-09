# Test Suite Documentation

This directory contains the comprehensive test suite for the Stampchain MCP Server. The tests are organized by category and use Jest as the testing framework with TypeScript support.

## Test Structure

```
src/__tests__/
├── api/                    # API client tests
│   └── stampchain-client.test.ts
├── config/                 # Configuration tests
│   └── configuration.test.ts
├── integration/            # End-to-end integration tests
│   └── mcp-server.test.ts
├── schemas/               # Schema validation tests
│   └── validation.test.ts
├── tools/                 # MCP tool tests
│   ├── registry.test.ts
│   └── stamps.test.ts
├── utils/                 # Utility and helper tests
│   ├── formatters.test.ts
│   └── test-helpers.ts
├── setup.ts              # Jest setup and configuration
├── run-tests.ts          # Custom test runner
└── README.md             # This file
```

## Running Tests

### Basic Commands

```bash
# Run all tests once
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests for CI (with coverage and verbose output)
npm run test:ci
```

### Category-Specific Tests

```bash
# Run only API tests
npm run test:api

# Run only tool tests
npm run test:tools

# Run only schema validation tests
npm run test:schemas

# Run only integration tests
npm run test:integration
```

### Advanced Options

```bash
# Run tests matching a specific pattern
npm test -- --testNamePattern="StampchainClient"

# Run tests for specific files
npm test -- --testPathPattern="api"

# Run tests with verbose output
npm test -- --verbose

# Run tests with custom worker count
npm test -- --maxWorkers=4
```

## Test Categories

### 1. API Client Tests (`api/`)

Tests for the `StampchainClient` class that handles all interactions with the Stampchain API.

**Coverage includes:**

- HTTP client configuration
- Request/response handling
- Error handling and retries
- Parameter validation
- Mock API responses

**Example:**

```typescript
it('should fetch stamp data successfully', async () => {
  const mockStamp = createMockStamp();
  mockedAxios.get.mockResolvedValueOnce(createMockAxiosResponse(mockStamp));

  const result = await client.getStamp(12345);
  expect(result).toEqual(mockStamp);
});
```

### 2. Schema Validation Tests (`schemas/`)

Tests for Zod schema validation used throughout the application.

**Coverage includes:**

- Input parameter validation
- Data structure validation
- Type coercion and defaults
- Error message generation

**Example:**

```typescript
it('should validate valid stamp data', () => {
  const validStamp = createMockStamp();
  const result = StampSchema.safeParse(validStamp);
  expect(result.success).toBe(true);
});
```

### 3. Tool Tests (`tools/`)

Tests for individual MCP tools and the tool registry system.

**Coverage includes:**

- Tool execution logic
- Parameter validation
- Error handling
- Output formatting
- Tool registry management

**Example:**

```typescript
it('should execute get_stamp tool successfully', async () => {
  const mockStamp = createMockStamp();
  mockContext.apiClient.getStamp.mockResolvedValueOnce(mockStamp);

  const result = await tool.execute({ stamp_id: 12345 }, mockContext);
  expect(result.content[0].text).toContain('Stamp #12345');
});
```

### 4. Configuration Tests (`config/`)

Tests for the configuration management system.

**Coverage includes:**

- Configuration loading and merging
- Environment variable handling
- File-based configuration
- CLI argument override
- Validation

### 5. Integration Tests (`integration/`)

End-to-end tests that verify the complete MCP server functionality.

**Coverage includes:**

- Server initialization
- Tool registration
- Request handling
- Error scenarios
- Complete workflows

### 6. Utility Tests (`utils/`)

Tests for utility functions and formatters.

**Coverage includes:**

- Data formatting
- Type conversion
- Helper functions

## Test Helpers and Utilities

### Mock Data Creators

The test suite includes helper functions to create consistent mock data:

```typescript
// Create mock stamp data
const mockStamp = createMockStamp({
  stamp: 12345,
  creator: 'bc1qtest123...',
});

// Create mock collection data
const mockCollection = createMockCollection({
  name: 'Test Collection',
  total_stamps: 100,
});

// Create mock token data
const mockToken = createMockToken({
  tick: 'TEST',
  holders: 1000,
});
```

### Test Context Creation

```typescript
// Create mock tool execution context
const mockContext = createMockToolContext();

// Create mock API client
const mockApiClient = createMockApiClient();
```

### Assertion Helpers

```typescript
// Test that a function throws with specific message
await expectToThrow(() => tool.execute({ invalid: 'params' }, context), 'Validation failed');
```

## Coverage Requirements

The test suite aims for high code coverage across all components:

- **Statements**: > 90%
- **Branches**: > 85%
- **Functions**: > 90%
- **Lines**: > 90%

### Coverage Reports

Coverage reports are generated in multiple formats:

- **Terminal**: Summary displayed after running `npm run test:coverage`
- **HTML**: Detailed report in `coverage/lcov-report/index.html`
- **LCOV**: Machine-readable format in `coverage/lcov.info`

## Mocking Strategy

### External Dependencies

All external dependencies are properly mocked:

```typescript
// Mock axios for API calls
jest.mock('axios');

// Mock MCP SDK components
jest.mock('@modelcontextprotocol/sdk/server/index.js');
```

### API Responses

API responses are mocked using helper functions:

```typescript
const mockResponse = createMockAxiosResponse(mockData, 200);
mockedAxios.get.mockResolvedValueOnce(mockResponse);
```

### Environment Variables

Environment variables are managed per test:

```typescript
beforeEach(() => {
  delete process.env.STAMPCHAIN_LOG_LEVEL;
  process.env.NODE_ENV = 'test';
});
```

## Writing New Tests

### Test File Naming

- Use `.test.ts` extension
- Match the source file name: `src/api/client.ts` → `src/__tests__/api/client.test.ts`

### Test Structure

```typescript
describe('ComponentName', () => {
  let component: ComponentType;

  beforeEach(() => {
    // Setup for each test
    component = new ComponentType();
  });

  describe('methodName', () => {
    it('should handle normal case', () => {
      // Test normal behavior
    });

    it('should handle error case', () => {
      // Test error scenarios
    });

    it('should validate inputs', () => {
      // Test input validation
    });
  });
});
```

### Best Practices

1. **Descriptive test names**: Use clear, descriptive test names that explain what is being tested
2. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and assertion phases
3. **Mock external dependencies**: Always mock external APIs, file system, and network calls
4. **Test edge cases**: Include tests for error conditions, boundary values, and edge cases
5. **Keep tests focused**: Each test should verify one specific behavior
6. **Use meaningful assertions**: Make assertions specific and meaningful

## Debugging Tests

### Running Individual Tests

```bash
# Run a specific test file
npm test -- stampchain-client.test.ts

# Run a specific test case
npm test -- --testNamePattern="should fetch stamp data"
```

### Debug Mode

```bash
# Run tests with Node.js debugging
node --inspect-brk node_modules/.bin/jest --runInBand

# Run with verbose output
npm test -- --verbose --no-coverage
```

### VS Code Integration

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Tests",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## Continuous Integration

The test suite is designed to run in CI environments:

```bash
# CI-optimized test command
npm run test:ci
```

This command includes:

- Coverage reporting
- Verbose output for CI logs
- Limited worker processes for stability
- Machine-readable output formats

## Performance Considerations

- **Parallel execution**: Tests run in parallel by default for faster execution
- **Selective test running**: Use patterns to run only relevant tests during development
- **Mock everything**: External dependencies are mocked to avoid network calls and improve speed
- **Resource cleanup**: Tests properly clean up resources and reset state

## Troubleshooting

### Common Issues

1. **Jest cannot resolve modules**: Ensure `jest.config.js` has correct module mapping
2. **TypeScript compilation errors**: Run `npm run typecheck` to verify TypeScript issues
3. **Mock not working**: Verify mock is declared before the import statement
4. **Test timeouts**: Increase timeout for async operations or check for unresolved promises

### Getting Help

- Check Jest documentation: https://jestjs.io/docs/getting-started
- Review existing tests for patterns
- Use `--verbose` flag for detailed test output
- Check the test setup file for global configurations
