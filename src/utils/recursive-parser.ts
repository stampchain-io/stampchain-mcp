/**
 * Recursive stamp parser for analyzing JavaScript and HTML content
 */

import { createLogger } from './logger.js';
import * as zlib from 'node:zlib';
import { promisify } from 'node:util';
import type {
  StampDependency,
  DetectedPattern,
  ParsedJavaScript,
  PatternDefinition,
  CodeStructure,
  SecurityAnalysis,
  PerformanceAnalysis,
} from '../schemas/recursive-stamps.js';

const logger = createLogger('RecursiveStampParser');
const gunzip = promisify(zlib.gunzip);

export class RecursiveStampParser {
  private patterns: PatternDefinition[] = [
    {
      name: 'Append Framework',
      regex: /new\s+Append\(\)/,
      confidence: 0.9,
      category: 'framework',
      description: 'Uses the Append framework for recursive loading',
    },
    {
      name: 'Async Loading Pattern',
      regex: /await\s+t\.(js|html)\(/,
      confidence: 0.8,
      category: 'pattern',
      description: 'Asynchronously loads content from other stamps',
    },
    {
      name: 'Error Handling Pattern',
      regex: /try\s*{[\s\S]*?}\s*catch\s*\(/,
      confidence: 0.7,
      category: 'pattern',
      description: 'Implements error handling for recursive loading',
    },
    {
      name: 'Dynamic Script Loading',
      regex: /document\.createElement\("script"\)/,
      confidence: 0.8,
      category: 'technique',
      description: 'Dynamically loads JavaScript from other stamps',
    },
    {
      name: 'Window OnLoad Handler',
      regex: /window\.onload\s*=/,
      confidence: 0.6,
      category: 'pattern',
      description: 'Executes code after window loads',
    },
    {
      name: 'Callback Pattern',
      regex: /appendCB\s*=\s*async\s*\(\)/,
      confidence: 0.7,
      category: 'pattern',
      description: 'Uses callback pattern for async operations',
    },
    {
      name: 'DOM Manipulation',
      regex: /document\.(body|head)\.appendChild/,
      confidence: 0.6,
      category: 'technique',
      description: 'Dynamically manipulates DOM elements',
    },
  ];

  /**
   * Parse JavaScript code to extract dependencies and patterns
   */
  parseJavaScript(code: string): ParsedJavaScript {
    logger.debug('Parsing JavaScript code', { codeLength: code.length });

    const dependencies: StampDependency[] = [];
    const patterns: DetectedPattern[] = [];
    const codeStructure = this.extractCodeElements(code);

    try {
      // Extract t.js() calls - these load JavaScript libraries
      const jsCallRegex = /await\s+t\.js\(\s*\[\s*"([^"]+)"\s*\]\s*\)/g;
      let match;
      while ((match = jsCallRegex.exec(code)) !== null) {
        dependencies.push({
          cpid: match[1],
          type: 'javascript',
          loadMethod: 't.js',
          isResolved: false,
        });
        logger.debug('Found t.js dependency', { cpid: match[1] });
      }

      // Extract t.html() calls - these load HTML/template data
      const htmlCallRegex = /await\s+t\.html\(\s*\[\s*"([^"]+)"\s*\]\s*,?\s*(\d+)?\s*\)/g;
      while ((match = htmlCallRegex.exec(code)) !== null) {
        dependencies.push({
          cpid: match[1], // This is actually compressed HTML data, not CPID
          type: 'html',
          loadMethod: 't.html',
          isResolved: false,
        });
        logger.debug('Found t.html dependency', { dataLength: match[1].length });
      }

      // Extract script src references to /s/ endpoint
      const scriptSrcRegex = /src\s*=\s*["']\/s\/([^"']+)["']/g;
      while ((match = scriptSrcRegex.exec(code)) !== null) {
        dependencies.push({
          cpid: match[1],
          type: 'script_src',
          loadMethod: 'script_tag',
          isResolved: false,
        });
        logger.debug('Found script src dependency', { cpid: match[1] });
      }

      // Extract setAttribute calls for script sources
      const setAttributeRegex = /setAttribute\s*\(\s*["']src["']\s*,\s*["']\/s\/([^"']+)["']\s*\)/g;
      while ((match = setAttributeRegex.exec(code)) !== null) {
        dependencies.push({
          cpid: match[1],
          type: 'script_src',
          loadMethod: 'script_tag',
          isResolved: false,
        });
        logger.debug('Found setAttribute script dependency', { cpid: match[1] });
      }

      // Detect patterns
      for (const pattern of this.patterns) {
        if (pattern.regex.test(code)) {
          const matches = code.match(pattern.regex);
          patterns.push({
            name: pattern.name,
            confidence: pattern.confidence,
            category: pattern.category,
            description: pattern.description,
            matches: matches || [],
          });
          logger.debug('Detected pattern', { name: pattern.name, confidence: pattern.confidence });
        }
      }

      logger.info('JavaScript parsing completed', {
        dependencyCount: dependencies.length,
        patternCount: patterns.length,
      });

      return {
        dependencies,
        patterns,
        usesAppendFramework: patterns.some((p) => p.name === 'Append Framework'),
        hasAsyncLoading: code.includes('await'),
        hasErrorHandling: code.includes('try') && code.includes('catch'),
        codeStructure,
      };
    } catch (error) {
      logger.error('Error parsing JavaScript', { error });
      throw new Error(
        `Failed to parse JavaScript: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Analyze code structure to extract functions, variables, etc.
   */
  private extractCodeElements(code: string): {
    functions: string[];
    variables: string[];
    imports: string[];
  } {
    const functions: string[] = [];
    const variables: string[] = [];
    const imports: string[] = [];

    // Extract function declarations
    const functionRegex = /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
    let match;
    while ((match = functionRegex.exec(code)) !== null) {
      functions.push(match[1]);
    }

    // Extract arrow functions assigned to variables
    const arrowFunctionRegex = /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g;
    while ((match = arrowFunctionRegex.exec(code)) !== null) {
      functions.push(match[1]);
    }

    // Extract variable declarations
    const variableRegex = /(?:let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    while ((match = variableRegex.exec(code)) !== null) {
      variables.push(match[1]);
    }

    // Extract imports (though rare in stamps)
    const importRegex = /import\s+.*?\s+from\s+["']([^"']+)["']/g;
    while ((match = importRegex.exec(code)) !== null) {
      imports.push(match[1]);
    }

    return { functions, variables, imports };
  }

  /**
   * Decompress HTML data if it's gzipped
   */
  async decompressHtmlData(base64Data: string): Promise<string> {
    logger.debug('Decompressing HTML data', { dataLength: base64Data.length });

    try {
      // Check if it's gzipped (starts with H4sI which is gzip header in base64)
      if (base64Data.startsWith('H4sI')) {
        const buffer = Buffer.from(base64Data, 'base64');
        const decompressed = await gunzip(buffer);
        const result = decompressed.toString('utf8');
        logger.debug('Successfully decompressed gzipped data', {
          originalLength: base64Data.length,
          decompressedLength: result.length,
        });
        return result;
      }

      // Otherwise, try to decode as regular base64
      const result = Buffer.from(base64Data, 'base64').toString('utf8');
      logger.debug('Decoded as regular base64', { decodedLength: result.length });
      return result;
    } catch (error) {
      logger.error('Error decompressing HTML data', { error });
      return `[Error decompressing data: ${error instanceof Error ? error.message : String(error)}]`;
    }
  }

  /**
   * Analyze code structure for recursive stamp features
   */
  analyzeCodeStructure(code: string): CodeStructure {
    const hasJavaScript = code.includes('<script>') || code.includes('javascript:');
    const hasHTML = code.includes('<html>') || code.includes('<!DOCTYPE');
    const usesAppendFramework = code.includes('new Append()') || code.includes('appendCB');
    const isRecursive = code.includes('/s/') || code.includes('t.js(') || code.includes('t.html(');
    const hasAsyncLoading =
      code.includes('await') && (code.includes('t.js') || code.includes('t.html'));
    const hasErrorHandling = code.includes('try') && code.includes('catch');

    return {
      hasJavaScript,
      hasHTML,
      usesAppendFramework,
      isRecursive,
      hasAsyncLoading,
      hasErrorHandling,
    };
  }

  /**
   * Perform basic security analysis on stamp code
   */
  analyzeCodeSecurity(code: string): SecurityAnalysis {
    const risks: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    // Check for potentially dangerous patterns
    const dangerousPatterns = [
      { pattern: /eval\s*\(/, risk: 'Code execution via eval()' },
      { pattern: /Function\s*\(/, risk: 'Dynamic function creation' },
      { pattern: /document\.write\s*\(/, risk: 'Document write injection' },
      { pattern: /innerHTML\s*=/, risk: 'HTML injection via innerHTML' },
      { pattern: /outerHTML\s*=/, risk: 'HTML injection via outerHTML' },
      { pattern: /location\s*=/, risk: 'Location manipulation' },
      { pattern: /window\.open\s*\(/, risk: 'Popup window creation' },
      { pattern: /XMLHttpRequest|fetch\s*\(/, risk: 'External network requests' },
    ];

    for (const { pattern, risk } of dangerousPatterns) {
      if (pattern.test(code)) {
        risks.push(risk);
        if (risk.includes('eval') || risk.includes('Function')) {
          riskLevel = 'high';
        } else if (riskLevel === 'low') {
          riskLevel = 'medium';
        }
      }
    }

    // Check for external URL references
    const urlRegex = /https?:\/\/[^\s"']+/g;
    const externalUrls = code.match(urlRegex);
    if (externalUrls && externalUrls.length > 0) {
      risks.push(`External URLs referenced: ${externalUrls.length}`);
      if (riskLevel === 'low') {
        riskLevel = 'medium';
      }
    }

    const hasDangerousPatterns = risks.length > 0;
    const isCodeSafe = riskLevel === 'low' && !hasDangerousPatterns;

    logger.debug('Security analysis completed', { riskLevel, riskCount: risks.length });

    return {
      riskLevel,
      risks,
      hasDangerousPatterns,
      isCodeSafe,
    };
  }

  /**
   * Analyze performance characteristics of stamp code
   */
  analyzeCodePerformance(code: string, dependencies: StampDependency[]): PerformanceAnalysis {
    let complexityScore = 0;

    // Base complexity from code length
    complexityScore += Math.min(code.length / 1000, 3); // Max 3 points for length

    // Complexity from dependencies
    complexityScore += Math.min(dependencies.length * 0.5, 2); // Max 2 points for dependencies

    // Complexity from async operations
    const asyncMatches = code.match(/await/g);
    if (asyncMatches) {
      complexityScore += Math.min(asyncMatches.length * 0.3, 2); // Max 2 points for async
    }

    // Complexity from DOM manipulation
    const domMatches = code.match(/document\./g);
    if (domMatches) {
      complexityScore += Math.min(domMatches.length * 0.2, 1); // Max 1 point for DOM
    }

    // Complexity from loops and conditionals
    const controlFlowMatches = code.match(/(?:for|while|if|switch)\s*\(/g);
    if (controlFlowMatches) {
      complexityScore += Math.min(controlFlowMatches.length * 0.1, 1); // Max 1 point for control flow
    }

    // Cap at 10
    complexityScore = Math.min(complexityScore, 10);

    // Calculate max dependency depth (simplified)
    const maxDependencyDepth =
      dependencies.length > 0 ? Math.ceil(Math.log2(dependencies.length + 1)) : 0;

    // Estimate load time (very rough)
    const estimatedLoadTime = dependencies.length * 100 + code.length * 0.01; // ms

    logger.debug('Performance analysis completed', {
      complexityScore,
      dependencyCount: dependencies.length,
      maxDependencyDepth,
      estimatedLoadTime,
    });

    return {
      complexityScore,
      dependencyCount: dependencies.length,
      maxDependencyDepth,
      estimatedLoadTime,
    };
  }

  /**
   * Detect patterns in stamp code
   */
  detectPatterns(code: string): DetectedPattern[] {
    const detected: DetectedPattern[] = [];

    for (const pattern of this.patterns) {
      if (pattern.regex.test(code)) {
        const matches = code.match(pattern.regex);
        detected.push({
          name: pattern.name,
          confidence: pattern.confidence,
          category: pattern.category,
          description: pattern.description,
          matches: matches || [],
        });
      }
    }

    return detected;
  }
}
