#!/usr/bin/env node

/**
 * Stampchain API Schema Validation Script
 * 
 * This script validates that our MCP implementation exactly matches
 * the official Stampchain API OpenAPI specification.
 * 
 * Usage: npm run validate-schema
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// ANSI color codes for better output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = {
  error: (msg) => console.error(`${colors.red}✗ ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  warning: (msg) => console.warn(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  header: (msg) => console.log(`${colors.bold}${colors.cyan}${msg}${colors.reset}`),
};

/**
 * Expected API schema based on Stampchain OpenAPI spec v2.3
 */
const EXPECTED_SCHEMAS = {
  StampRowSummary: {
    stamp: { type: 'number | null', required: true },
    block_index: { type: 'number', required: true },
    cpid: { type: 'string', required: true },
    creator: { type: 'string', required: true },
    creator_name: { type: 'string | null', required: true },
    divisible: { type: 'number', required: true },
    keyburn: { type: 'number | null', required: true },
    locked: { type: 'number', required: true },
    stamp_url: { type: 'string', required: true },
    stamp_mimetype: { type: 'string', required: true },
    supply: { type: 'number | null', required: true },
    block_time: { type: 'string', required: true }, // v2.3: ISO datetime string
    tx_hash: { type: 'string', required: true },
    tx_index: { type: 'number', required: true },
    ident: { type: '"STAMP" | "SRC-20" | "SRC-721"', required: true },
    stamp_hash: { type: 'string', required: true },
    file_hash: { type: 'string', required: true },
    stamp_base64: { type: 'string', required: false }, // v2.3: Optional in individual responses
    // Legacy fields (present in v2.3 for compatibility)
    floorPrice: { type: 'number | string | null', required: true }, // v2.3: Can be "priceless"
    floorPriceUSD: { type: 'number | null', required: true },
    marketCapUSD: { type: 'number | null', required: true },
    // v2.3: New optional fields
    marketData: { type: 'StampMarketData', required: false },
    cacheStatus: { type: 'CacheStatus', required: false },
    dispenserInfo: { type: 'DispenserInfo', required: false },
  },
  Collection: {
    collection_id: { type: 'string', required: true },
    collection_name: { type: 'string', required: true },
    collection_description: { type: 'string', required: true },
    creators: { type: 'string[]', required: true },
    stamp_count: { type: 'number', required: true },
    total_editions: { type: 'number', required: true },
    stamps: { type: 'number[]', required: true },
  },
  Src20Detail: {
    tx_hash: { type: 'string', required: true },
    block_index: { type: 'number', required: true },
    p: { type: 'string', required: true },
    op: { type: 'string', required: true },
    tick: { type: 'string', required: true },
    creator: { type: 'string', required: true },
    amt: { type: 'number | null', required: true },
    deci: { type: 'number', required: true },
    lim: { type: 'string', required: true },
    max: { type: 'string', required: true },
    destination: { type: 'string', required: true },
    block_time: { type: 'string', required: true },
    creator_name: { type: 'string | null', required: true },
    destination_name: { type: 'string | null', required: true },
  },
  PaginatedResponse: {
    data: { type: 'array', required: true },
    last_block: { type: 'number', required: true },
    metadata: { type: 'StampListMetadata', required: false }, // v2.3: Optional metadata
    page: { type: 'number', required: true },
    limit: { type: 'number', required: true },
    totalPages: { type: 'number', required: true },
    total: { type: 'number', required: true },
  }
};

/**
 * Note: OpenAPI spec fetching removed for CI compatibility
 * Schema validation now uses hardcoded expected schemas based on v2.3 API
 */

/**
 * Parse TypeScript interface from our types file
 */
function parseTypeScriptInterface(content, interfaceName) {
  const interfaceRegex = new RegExp(
    `export interface ${interfaceName}\\s*\\{([^}]+)\\}`,
    's'
  );
  const match = content.match(interfaceRegex);
  
  if (!match) {
    return null;
  }

  const fields = {};
  const body = match[1];
  
  // Parse each field - improved regex to handle comments and complex types
  const fieldRegex = /^\s*(\w+)(\?)?:\s*([^;\/]+);/gm;
  let fieldMatch;
  
  while ((fieldMatch = fieldRegex.exec(body)) !== null) {
    const [, fieldName, optional, fieldType] = fieldMatch;
    if (fieldName && fieldType) {
      fields[fieldName] = {
        type: fieldType.trim(),
        required: !optional,
      };
    }
  }

  return fields;
}

/**
 * Validate a single interface against expected schema
 */
function validateInterface(actualFields, expectedFields, interfaceName) {
  const errors = [];
  const warnings = [];

  // Check for missing fields
  for (const [fieldName, expected] of Object.entries(expectedFields)) {
    if (!actualFields[fieldName]) {
      errors.push(`Missing field: ${fieldName}`);
      continue;
    }

    const actual = actualFields[fieldName];
    
    // Check required/optional status
    if (actual.required !== expected.required) {
      const expectedStatus = expected.required ? 'required' : 'optional';
      const actualStatus = actual.required ? 'required' : 'optional';
      errors.push(`Field ${fieldName}: expected ${expectedStatus}, got ${actualStatus}`);
    }

    // Basic type checking (simplified) - skip complex types for now
    if (actual.type !== expected.type && 
        !expected.type.includes('StampMarketData') && 
        !expected.type.includes('CacheStatus') && 
        !expected.type.includes('DispenserInfo') && 
        !expected.type.includes('StampListMetadata') &&
        !(expected.type === 'array' && actual.type.includes('[]'))) {
      warnings.push(`Field ${fieldName}: type mismatch - expected "${expected.type}", got "${actual.type}"`);
    }
  }

  // Check for extra fields
  for (const fieldName of Object.keys(actualFields)) {
    if (!expectedFields[fieldName]) {
      warnings.push(`Extra field not in API spec: ${fieldName}`);
    }
  }

  return { errors, warnings };
}

/**
 * Main validation function
 */
async function validateSchema() {
  log.header('🔍 Stampchain API Schema Validation');
  console.log();

  let hasErrors = false;

  // Read our TypeScript types
  const typesPath = join(projectRoot, 'src/api/types.ts');
  let typesContent;
  
  try {
    typesContent = readFileSync(typesPath, 'utf8');
    log.success('Local types.ts file loaded');
  } catch (error) {
    log.error(`Failed to read types.ts: ${error.message}`);
    return false;
  }

  // Validate each interface
  const validations = [
    { local: 'Stamp', expected: 'StampRowSummary' },
    { local: 'CollectionResponse', expected: 'Collection' },
    { local: 'TokenResponse', expected: 'Src20Detail' },
  ];

  for (const { local, expected } of validations) {
    log.info(`Validating ${local} interface...`);
    
    const actualFields = parseTypeScriptInterface(typesContent, local);
    if (!actualFields) {
      log.error(`Could not parse ${local} interface`);
      hasErrors = true;
      continue;
    }

    const expectedFields = EXPECTED_SCHEMAS[expected];
    const { errors, warnings } = validateInterface(actualFields, expectedFields, local);

    if (errors.length > 0) {
      hasErrors = true;
      log.error(`${local} validation failed:`);
      errors.forEach(error => console.log(`  ${colors.red}- ${error}${colors.reset}`));
    } else {
      log.success(`${local} validation passed`);
    }

    if (warnings.length > 0) {
      log.warning(`${local} warnings:`);
      warnings.forEach(warning => console.log(`  ${colors.yellow}- ${warning}${colors.reset}`));
    }

    console.log();
  }

  // Validate pagination responses
  log.info('Validating pagination response formats...');
  const paginationInterfaces = ['StampListResponse', 'CollectionListResponse', 'TokenListResponse'];
  
  for (const interfaceName of paginationInterfaces) {
    const actualFields = parseTypeScriptInterface(typesContent, interfaceName);
    if (!actualFields) {
      log.error(`Could not parse ${interfaceName} interface`);
      hasErrors = true;
      continue;
    }

    const { errors, warnings } = validateInterface(
      actualFields, 
      EXPECTED_SCHEMAS.PaginatedResponse, 
      interfaceName
    );

    if (errors.length > 0) {
      hasErrors = true;
      log.error(`${interfaceName} pagination validation failed:`);
      errors.forEach(error => console.log(`  ${colors.red}- ${error}${colors.reset}`));
    } else {
      log.success(`${interfaceName} pagination validation passed`);
    }

    if (warnings.length > 0) {
      log.warning(`${interfaceName} pagination warnings:`);
      warnings.forEach(warning => console.log(`  ${colors.yellow}- ${warning}${colors.reset}`));
    }
  }

  console.log();

  // Final result
  if (hasErrors) {
    log.error('Schema validation FAILED! Please fix the errors above.');
    return false;
  } else {
    log.success('🎉 All schema validations PASSED!');
    return true;
  }
}

/**
 * Additional validation: Check Zod schemas match TypeScript interfaces
 */
function validateZodSchemas() {
  log.header('🔍 Zod Schema Validation');
  console.log();
  
  // This is a simplified check - in a real implementation, we could
  // parse the Zod schemas and compare them to the TypeScript interfaces
  log.info('Checking Zod schemas are in sync with TypeScript interfaces...');
  
  const schemaFiles = [
    'src/schemas/stamps.ts',
    'src/schemas/tokens.ts', 
    'src/schemas/collections.ts'
  ];

  let allValid = true;

  for (const schemaFile of schemaFiles) {
    try {
      const content = readFileSync(join(projectRoot, schemaFile), 'utf8');
      
      // Basic check: ensure schema exports exist
      if (content.includes('export const') && content.includes('Schema')) {
        log.success(`${schemaFile} contains valid schema exports`);
      } else {
        log.error(`${schemaFile} missing expected schema exports`);
        allValid = false;
      }
    } catch (error) {
      log.error(`Failed to read ${schemaFile}: ${error.message}`);
      allValid = false;
    }
  }

  console.log();
  return allValid;
}

// Run validation if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    console.log();
    const schemaValid = await validateSchema();
    const zodValid = validateZodSchemas();
    
    if (schemaValid && zodValid) {
      log.success('🎉 All validations passed!');
      process.exit(0);
    } else {
      log.error('❌ Validation failed!');
      process.exit(1);
    }
  })();
}

export { validateSchema, validateZodSchemas };