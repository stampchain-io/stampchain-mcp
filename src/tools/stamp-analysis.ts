/**
 * Recursive stamp analysis MCP tool
 * Analyzes stamp code structure, dependencies, and patterns
 */

import { z } from 'zod';
import type { Tool as MCPTool } from '@modelcontextprotocol/sdk/types.js';
import type { ToolResponse, ToolContext } from '../interfaces/tool.js';
import { textResponse, multiResponse, BaseTool } from '../interfaces/tool.js';
import { ToolExecutionError, ValidationError } from '../utils/errors.js';
import { handleMCPError, handleValidationError } from '../utils/mcp-error-handler.js';
import { StampchainClient } from '../api/stampchain-client.js';
import { RecursiveStampParser } from '../utils/recursive-parser.js';
import { parseStampId, isStampIdentifier } from '../utils/validators.js';
import { createLogger } from '../utils/logger.js';
import type { Stamp } from '../api/types.js';
import {
  AnalyzeStampCodeParamsSchema,
  GetStampDependenciesParamsSchema,
  AnalyzeStampPatternsParamsSchema,
  type AnalyzeStampCodeParams,
  type GetStampDependenciesParams,
  type AnalyzeStampPatternsParams,
  type StampAnalysisResult,
  type StampDependency,
  type StampPatternAnalysisResult,
  type PatternUsageStats,
} from '../schemas/recursive-stamps.js';

const logger = createLogger('StampAnalysisTool');

/**
 * Tool for analyzing recursive stamp code structure and dependencies
 */
export class AnalyzeStampCodeTool extends BaseTool<
  z.input<typeof AnalyzeStampCodeParamsSchema>,
  AnalyzeStampCodeParams
> {
  public readonly name = 'analyze_stamp_code';

  public readonly description =
    'Analyze the code structure and dependencies of a recursive stamp, including JavaScript parsing, dependency resolution, and pattern detection';

  public readonly inputSchema: MCPTool['inputSchema'] = {
    type: 'object',
    properties: {
      stamp_id: {
        type: ['number', 'string'],
        description: 'The ID or CPID of the stamp to analyze',
      },
      include_dependencies: {
        type: 'boolean',
        description: 'Whether to analyze referenced stamps',
        default: true,
      },
      max_depth: {
        type: 'number',
        description: 'Maximum depth for dependency analysis',
        default: 3,
        minimum: 1,
        maximum: 10,
      },
      include_raw_content: {
        type: 'boolean',
        description: 'Whether to include raw stamp content in response',
        default: false,
      },
      include_security_analysis: {
        type: 'boolean',
        description: 'Whether to include security analysis',
        default: true,
      },
      include_performance_analysis: {
        type: 'boolean',
        description: 'Whether to include performance analysis',
        default: true,
      },
    },
    required: ['stamp_id'],
  };

  public readonly schema = AnalyzeStampCodeParamsSchema;

  public readonly metadata = {
    version: '1.0.0',
    tags: ['stamps', 'analysis', 'recursive', 'dependencies'],
    requiresNetwork: true,
    apiDependencies: ['stampchain'],
  };

  private apiClient: StampchainClient;
  private parser: RecursiveStampParser;

  constructor(apiClient?: StampchainClient) {
    super();
    this.apiClient = apiClient || new StampchainClient();
    this.parser = new RecursiveStampParser();
  }

  public async execute(
    params: AnalyzeStampCodeParams,
    context?: ToolContext
  ): Promise<ToolResponse> {
    try {
      context?.logger?.info('Executing analyze_stamp_code tool', { params });

      // Validate parameters
      const validatedParams = this.validateParams(params);

      // Resolve stamp ID from CPID if needed
      const stamp = await this.resolveStamp(validatedParams.stamp_id, context);

      // Analyze the stamp
      const analysis = await this.analyzeStamp(stamp, validatedParams, context);

      // Format response
      const formattedResponse = this.formatAnalysisResponse(analysis, validatedParams);

      return multiResponse(
        { type: 'text', text: formattedResponse },
        { type: 'text', text: `\nDetailed Analysis:\n${JSON.stringify(analysis, null, 2)}` }
      );
    } catch (error) {
      // Handle Zod validation errors with new standardized pattern
      if (error instanceof z.ZodError) {
        const result = handleValidationError(error, this.name, params, context);
        return result.response;
      }

      // Handle all other errors with standardized pattern
      const result = handleMCPError(error, this.name, 'stamp_analysis', params, context);
      return result.response;
    }
  }

  /**
   * Resolve stamp by ID or CPID
   */
  private async resolveStamp(stampId: string | number, context?: ToolContext): Promise<Stamp> {
    try {
      // If it's a number, use it directly
      if (typeof stampId === 'number') {
        return await this.apiClient.getStamp(stampId);
      }

      // If it's a string, determine if it's a numeric ID or CPID
      try {
        const identifier = isStampIdentifier(stampId);

        if (identifier.type === 'id') {
          // It's a numeric ID
          return await this.apiClient.getStamp(identifier.value as number);
        } else {
          // It's a CPID, search for it first to get the stamp ID
          context?.logger?.debug('Searching for stamp by CPID', { cpid: identifier.value });
          const searchResults = await this.apiClient.searchStamps({
            cpid: identifier.value as string,
          });

          if (searchResults.length === 0) {
            throw new ToolExecutionError(
              `No stamp found with CPID: ${identifier.value}`,
              this.name
            );
          }

          // Now get the full stamp data with base64 content using the stamp ID
          const stampId = searchResults[0].stamp;
          if (!stampId) {
            throw new ToolExecutionError(
              `Invalid stamp ID for CPID: ${identifier.value}`,
              this.name
            );
          }

          context?.logger?.debug('Getting full stamp data', { stampId });
          return await this.apiClient.getStamp(stampId);
        }
      } catch (validationError) {
        throw new ToolExecutionError(
          `Invalid stamp identifier: ${validationError instanceof Error ? validationError.message : String(validationError)}`,
          this.name,
          validationError
        );
      }
    } catch (error) {
      if (error instanceof ToolExecutionError) {
        throw error;
      }
      throw new ToolExecutionError(
        `Failed to resolve stamp: ${error instanceof Error ? error.message : String(error)}`,
        this.name,
        error
      );
    }
  }

  /**
   * Analyze a stamp for recursive patterns and dependencies
   */
  private async analyzeStamp(
    stamp: Stamp,
    params: AnalyzeStampCodeParams,
    context?: ToolContext
  ): Promise<StampAnalysisResult> {
    context?.logger?.debug('Analyzing stamp', { stampId: stamp.stamp, cpid: stamp.cpid });

    // Get the stamp content
    if (!stamp.stamp_base64) {
      throw new ToolExecutionError(
        `Stamp ${stamp.stamp} does not have base64 content available`,
        this.name
      );
    }

    // Decode the content
    const rawContent = Buffer.from(stamp.stamp_base64, 'base64').toString('utf8');
    context?.logger?.debug('Decoded stamp content', { contentLength: rawContent.length });

    // Parse the JavaScript code
    const parsedJs = this.parser.parseJavaScript(rawContent);

    // Analyze code structure
    const codeStructure = this.parser.analyzeCodeStructure(rawContent);

    // Resolve dependencies if requested
    let resolvedDependencies: StampDependency[] = parsedJs.dependencies;
    if (params.include_dependencies) {
      resolvedDependencies = await this.resolveDependencies(
        parsedJs.dependencies,
        params.max_depth,
        context
      );
    }

    // Perform security analysis if requested
    let security;
    if (params.include_security_analysis) {
      security = this.parser.analyzeCodeSecurity(rawContent);
    } else {
      security = {
        riskLevel: 'low' as const,
        risks: [],
        hasDangerousPatterns: false,
        isCodeSafe: true,
      };
    }

    // Perform performance analysis if requested
    let performance;
    if (params.include_performance_analysis) {
      performance = this.parser.analyzeCodePerformance(rawContent, resolvedDependencies);
    } else {
      performance = {
        complexityScore: 0,
        dependencyCount: resolvedDependencies.length,
        maxDependencyDepth: 0,
      };
    }

    // Process HTML data if present
    let decodedContent: string | undefined;
    for (const dep of resolvedDependencies) {
      if (dep.type === 'html' && dep.cpid) {
        try {
          decodedContent = await this.parser.decompressHtmlData(dep.cpid);
          break; // Only process the first HTML dependency for now
        } catch (error) {
          context?.logger?.warn('Failed to decompress HTML data', { error });
        }
      }
    }

    const result: StampAnalysisResult = {
      stamp: {
        id: stamp.stamp || 0,
        cpid: stamp.cpid,
        creator: stamp.creator,
        mimetype: stamp.stamp_mimetype,
        blockIndex: stamp.block_index,
        txHash: stamp.tx_hash,
      },
      codeStructure,
      dependencies: resolvedDependencies,
      patterns: parsedJs.patterns,
      security,
      performance,
      rawContent: params.include_raw_content ? rawContent : undefined,
      decodedContent,
      analysisTimestamp: Date.now(),
    };

    context?.logger?.info('Stamp analysis completed', {
      stampId: stamp.stamp,
      dependencyCount: resolvedDependencies.length,
      patternCount: parsedJs.patterns.length,
      isRecursive: codeStructure.isRecursive,
    });

    return result;
  }

  /**
   * Resolve stamp dependencies by looking up their metadata
   */
  private async resolveDependencies(
    dependencies: StampDependency[],
    maxDepth: number,
    context?: ToolContext,
    currentDepth: number = 0
  ): Promise<StampDependency[]> {
    if (currentDepth >= maxDepth) {
      return dependencies;
    }

    const resolved: StampDependency[] = [];

    for (const dep of dependencies) {
      const resolvedDep = { ...dep };

      // Only try to resolve CPID dependencies (not HTML data)
      if (dep.type !== 'html' && dep.cpid && dep.cpid.match(/^A[0-9]+$/)) {
        try {
          context?.logger?.debug('Resolving dependency', { cpid: dep.cpid });
          const searchResults = await this.apiClient.searchStamps({ cpid: dep.cpid });

          if (searchResults.length > 0) {
            resolvedDep.isResolved = true;
            resolvedDep.stampId = searchResults[0].stamp || undefined;
            resolvedDep.metadata = searchResults[0];

            context?.logger?.debug('Resolved dependency', {
              cpid: dep.cpid,
              stampId: searchResults[0].stamp,
            });
          } else {
            context?.logger?.warn('Could not resolve dependency', { cpid: dep.cpid });
          }
        } catch (error) {
          context?.logger?.warn('Error resolving dependency', { cpid: dep.cpid, error });
        }
      }

      resolved.push(resolvedDep);
    }

    return resolved;
  }

  /**
   * Format the analysis response for display
   */
  private formatAnalysisResponse(
    analysis: StampAnalysisResult,
    params: AnalyzeStampCodeParams
  ): string {
    const lines: string[] = [];

    lines.push(`🔍 Recursive Stamp Analysis Report`);
    lines.push(`=====================================`);
    lines.push('');

    // Basic stamp info
    lines.push(`📄 Stamp Information:`);
    lines.push(`   ID: ${analysis.stamp.id}`);
    lines.push(`   CPID: ${analysis.stamp.cpid}`);
    lines.push(`   Creator: ${analysis.stamp.creator}`);
    lines.push(`   MIME Type: ${analysis.stamp.mimetype}`);
    lines.push(`   Block: ${analysis.stamp.blockIndex}`);
    lines.push('');

    // Code structure
    lines.push(`🏗️  Code Structure:`);
    lines.push(`   Has JavaScript: ${analysis.codeStructure.hasJavaScript ? '✅' : '❌'}`);
    lines.push(`   Has HTML: ${analysis.codeStructure.hasHTML ? '✅' : '❌'}`);
    lines.push(
      `   Uses Append Framework: ${analysis.codeStructure.usesAppendFramework ? '✅' : '❌'}`
    );
    lines.push(`   Is Recursive: ${analysis.codeStructure.isRecursive ? '✅' : '❌'}`);
    lines.push(`   Has Async Loading: ${analysis.codeStructure.hasAsyncLoading ? '✅' : '❌'}`);
    lines.push(`   Has Error Handling: ${analysis.codeStructure.hasErrorHandling ? '✅' : '❌'}`);
    lines.push('');

    // Dependencies
    if (analysis.dependencies.length > 0) {
      lines.push(`🔗 Dependencies (${analysis.dependencies.length}):`);
      analysis.dependencies.forEach((dep, index) => {
        const status = dep.isResolved ? '✅' : '❌';
        const stampInfo = dep.stampId ? ` (Stamp #${dep.stampId})` : '';
        lines.push(
          `   ${index + 1}. ${status} ${dep.cpid} [${dep.type}/${dep.loadMethod}]${stampInfo}`
        );
      });
      lines.push('');
    }

    // Patterns
    if (analysis.patterns.length > 0) {
      lines.push(`🎯 Detected Patterns (${analysis.patterns.length}):`);
      analysis.patterns.forEach((pattern, index) => {
        const confidence = Math.round(pattern.confidence * 100);
        lines.push(`   ${index + 1}. ${pattern.name} (${confidence}% confidence)`);
        lines.push(`      Category: ${pattern.category}`);
        lines.push(`      Description: ${pattern.description}`);
      });
      lines.push('');
    }

    // Security analysis
    if (params.include_security_analysis) {
      const riskIcon =
        analysis.security.riskLevel === 'low'
          ? '🟢'
          : analysis.security.riskLevel === 'medium'
            ? '🟡'
            : '🔴';
      lines.push(`🔒 Security Analysis:`);
      lines.push(`   Risk Level: ${riskIcon} ${analysis.security.riskLevel.toUpperCase()}`);
      lines.push(
        `   Code Safety: ${analysis.security.isCodeSafe ? '✅ Safe' : '⚠️ Potentially Unsafe'}`
      );
      if (analysis.security.risks.length > 0) {
        lines.push(`   Risks Found:`);
        analysis.security.risks.forEach((risk, index) => {
          lines.push(`     ${index + 1}. ${risk}`);
        });
      }
      lines.push('');
    }

    // Performance analysis
    if (params.include_performance_analysis) {
      const complexityIcon =
        analysis.performance.complexityScore <= 3
          ? '🟢'
          : analysis.performance.complexityScore <= 6
            ? '🟡'
            : '🔴';
      lines.push(`⚡ Performance Analysis:`);
      lines.push(
        `   Complexity Score: ${complexityIcon} ${analysis.performance.complexityScore.toFixed(1)}/10`
      );
      lines.push(`   Dependency Count: ${analysis.performance.dependencyCount}`);
      lines.push(`   Max Dependency Depth: ${analysis.performance.maxDependencyDepth}`);
      if (analysis.performance.estimatedLoadTime) {
        lines.push(
          `   Estimated Load Time: ${analysis.performance.estimatedLoadTime.toFixed(0)}ms`
        );
      }
      lines.push('');
    }

    // Decoded HTML content
    if (analysis.decodedContent) {
      lines.push(`📝 Decoded HTML Content:`);
      lines.push(`   Length: ${analysis.decodedContent.length} characters`);
      lines.push(
        `   Preview: ${analysis.decodedContent.substring(0, 200)}${analysis.decodedContent.length > 200 ? '...' : ''}`
      );
      lines.push('');
    }

    lines.push(`📊 Analysis completed at ${new Date(analysis.analysisTimestamp).toISOString()}`);

    return lines.join('\n');
  }
}

/**
 * Tool for mapping stamp dependencies and creating dependency graphs
 */
export class GetStampDependenciesTool extends BaseTool<
  z.input<typeof GetStampDependenciesParamsSchema>,
  GetStampDependenciesParams
> {
  public readonly name = 'get_stamp_dependencies';

  public readonly description =
    'Create a hierarchical dependency graph for a recursive stamp, showing all referenced stamps and their relationships';

  public readonly inputSchema: MCPTool['inputSchema'] = {
    type: 'object',
    properties: {
      stamp_id: {
        type: ['number', 'string'],
        description: 'The ID or CPID of the stamp to map dependencies for',
      },
      max_depth: {
        type: 'number',
        description: 'Maximum depth to traverse dependencies',
        default: 5,
        minimum: 1,
        maximum: 10,
      },
      include_metadata: {
        type: 'boolean',
        description: 'Include full stamp metadata for each dependency',
        default: true,
      },
      format: {
        type: 'string',
        enum: ['tree', 'graph', 'mermaid', 'json'],
        description: 'Output format for the dependency structure',
        default: 'tree',
      },
      resolve_all: {
        type: 'boolean',
        description: 'Attempt to resolve all dependencies (may be slow for deep graphs)',
        default: true,
      },
    },
    required: ['stamp_id'],
  };

  public readonly schema = GetStampDependenciesParamsSchema;

  public readonly metadata = {
    version: '1.0.0',
    tags: ['stamps', 'dependencies', 'visualization', 'mapping'],
    requiresNetwork: true,
    apiDependencies: ['stampchain'],
  };

  private apiClient: StampchainClient;
  private parser: RecursiveStampParser;

  constructor(apiClient?: StampchainClient) {
    super();
    this.apiClient = apiClient || new StampchainClient();
    this.parser = new RecursiveStampParser();
  }

  public async execute(
    params: GetStampDependenciesParams,
    context?: ToolContext
  ): Promise<ToolResponse> {
    try {
      context?.logger?.info('Executing get_stamp_dependencies tool', { params });

      // Validate parameters
      const validatedParams = this.validateParams(params);

      // Resolve the root stamp
      const rootStamp = await this.resolveStamp(validatedParams.stamp_id, context);

      // Build the dependency tree
      const dependencyTree = await this.buildDependencyTree(rootStamp, validatedParams, context);

      // Format the output based on requested format
      const formattedOutput = this.formatDependencyTree(
        dependencyTree,
        validatedParams.format,
        context
      );

      // Return both formatted output and raw data
      return multiResponse(
        { type: 'text', text: formattedOutput },
        { type: 'text', text: `\nRaw Dependency Data:\n${JSON.stringify(dependencyTree, null, 2)}` }
      );
    } catch (error) {
      context?.logger?.error('Error executing get_stamp_dependencies tool', { error });

      if (error instanceof ValidationError) {
        throw error;
      }

      if (error instanceof ToolExecutionError) {
        throw error;
      }

      if (error instanceof Error) {
        throw new ToolExecutionError(error.message, this.name, error);
      }

      throw new ToolExecutionError('Failed to map stamp dependencies', this.name, error);
    }
  }

  /**
   * Resolve stamp by ID or CPID
   */
  private async resolveStamp(stampId: string | number, context?: ToolContext): Promise<Stamp> {
    try {
      if (typeof stampId === 'number') {
        return await this.apiClient.getStamp(stampId);
      }

      const identifier = isStampIdentifier(stampId);

      if (identifier.type === 'id') {
        return await this.apiClient.getStamp(identifier.value as number);
      } else {
        // Search for CPID and get full stamp data
        context?.logger?.debug('Searching for stamp by CPID', { cpid: identifier.value });
        const searchResults = await this.apiClient.searchStamps({
          cpid: identifier.value as string,
        });

        if (searchResults.length === 0) {
          throw new ToolExecutionError(`No stamp found with CPID: ${identifier.value}`, this.name);
        }

        const stampId = searchResults[0].stamp;
        if (!stampId) {
          throw new ToolExecutionError(`Invalid stamp ID for CPID: ${identifier.value}`, this.name);
        }

        return await this.apiClient.getStamp(stampId);
      }
    } catch (error) {
      if (error instanceof ToolExecutionError) {
        throw error;
      }
      throw new ToolExecutionError(
        `Failed to resolve stamp: ${error instanceof Error ? error.message : String(error)}`,
        this.name,
        error
      );
    }
  }

  /**
   * Build a complete dependency tree for a stamp
   */
  private async buildDependencyTree(
    rootStamp: Stamp,
    params: GetStampDependenciesParams,
    context?: ToolContext,
    visited: Set<string> = new Set(),
    currentDepth: number = 0
  ): Promise<any> {
    const rootCpid = rootStamp.cpid;

    // Prevent infinite recursion
    if (visited.has(rootCpid) || currentDepth >= params.max_depth) {
      return {
        root: this.createTreeNode(rootStamp, [], currentDepth, params.include_metadata),
        nodes: new Map(),
        edges: [],
        totalNodes: 1,
        maxDepth: currentDepth,
        circularReferences: visited.has(rootCpid) ? [rootCpid] : [],
      };
    }

    visited.add(rootCpid);
    context?.logger?.debug('Building dependency tree', {
      cpid: rootCpid,
      depth: currentDepth,
      visited: visited.size,
    });

    // Parse dependencies from stamp content
    let dependencies: StampDependency[] = [];
    if (rootStamp.stamp_base64) {
      try {
        const rawContent = Buffer.from(rootStamp.stamp_base64, 'base64').toString('utf8');
        const parsedJs = this.parser.parseJavaScript(rawContent);
        dependencies = parsedJs.dependencies;
      } catch (error) {
        context?.logger?.warn('Failed to parse stamp content', { cpid: rootCpid, error });
      }
    }

    // Resolve child dependencies if requested
    const childNodes: any[] = [];
    const allNodes = new Map<string, any>();
    const allEdges: Array<{ from: string; to: string; type: string }> = [];
    const circularRefs: string[] = [];
    let totalNodes = 1;
    let maxDepth = currentDepth;

    if (params.resolve_all && dependencies.length > 0) {
      for (const dep of dependencies) {
        // Skip HTML data dependencies (not actual stamps)
        if (dep.type === 'html' || !dep.cpid || !dep.cpid.match(/^A[0-9]+$/)) {
          continue;
        }

        try {
          // Check for circular reference
          if (visited.has(dep.cpid)) {
            circularRefs.push(dep.cpid);
            context?.logger?.warn('Circular dependency detected', {
              from: rootCpid,
              to: dep.cpid,
            });
            continue;
          }

          // Resolve the dependency
          const searchResults = await this.apiClient.searchStamps({ cpid: dep.cpid });
          if (searchResults.length > 0) {
            const depStamp = searchResults[0];
            const depStampId = depStamp.stamp;

            if (depStampId) {
              const fullDepStamp = await this.apiClient.getStamp(depStampId);

              // Recursively build child tree
              const childTree = await this.buildDependencyTree(
                fullDepStamp,
                params,
                context,
                new Set(visited),
                currentDepth + 1
              );

              childNodes.push(childTree.root);

              // Merge child tree data
              childTree.nodes.forEach((node: any, cpid: string) => allNodes.set(cpid, node));
              allEdges.push(...childTree.edges);
              circularRefs.push(...childTree.circularReferences);
              totalNodes += childTree.totalNodes;
              maxDepth = Math.max(maxDepth, childTree.maxDepth);

              // Add edge from root to child
              allEdges.push({
                from: rootCpid,
                to: dep.cpid,
                type: dep.loadMethod,
              });
            }
          }
        } catch (error) {
          context?.logger?.warn('Failed to resolve dependency', {
            cpid: dep.cpid,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    // Create the root node
    const rootNode = this.createTreeNode(
      rootStamp,
      childNodes,
      currentDepth,
      params.include_metadata
    );
    allNodes.set(rootCpid, rootNode);

    return {
      root: rootNode,
      nodes: allNodes,
      edges: allEdges,
      totalNodes,
      maxDepth,
      circularReferences: [...new Set(circularRefs)],
    };
  }

  /**
   * Create a tree node from stamp data
   */
  private createTreeNode(
    stamp: Stamp,
    children: any[],
    depth: number,
    includeMetadata: boolean
  ): any {
    const node: any = {
      cpid: stamp.cpid,
      stampId: stamp.stamp || 0,
      depth,
      children,
      metadata: includeMetadata
        ? {
            creator: stamp.creator,
            mimetype: stamp.stamp_mimetype,
            blockIndex: stamp.block_index,
            txHash: stamp.tx_hash,
            supply: stamp.supply || 0,
            locked: Boolean(stamp.locked),
          }
        : undefined,
    };

    return node;
  }

  /**
   * Format dependency tree based on requested output format
   */
  private formatDependencyTree(tree: any, format: string, context?: ToolContext): string {
    switch (format) {
      case 'tree':
        return this.formatAsTree(tree);
      case 'mermaid':
        return this.formatAsMermaid(tree);
      case 'graph':
        return this.formatAsGraph(tree);
      case 'json':
        return JSON.stringify(tree, null, 2);
      default:
        return this.formatAsTree(tree);
    }
  }

  /**
   * Format dependency tree as a tree structure
   */
  private formatAsTree(tree: any): string {
    const lines: string[] = [];

    lines.push('🌳 Stamp Dependency Tree');
    lines.push('========================');
    lines.push('');

    // Summary
    lines.push(`📊 Tree Summary:`);
    lines.push(`   Total Nodes: ${tree.totalNodes}`);
    lines.push(`   Max Depth: ${tree.maxDepth}`);
    lines.push(`   Edges: ${tree.edges.length}`);
    if (tree.circularReferences.length > 0) {
      lines.push(`   ⚠️ Circular References: ${tree.circularReferences.length}`);
    }
    lines.push('');

    // Tree structure
    lines.push('🏗️ Dependency Structure:');
    this.renderTreeNode(tree.root, lines, '', true);

    // Circular references warning
    if (tree.circularReferences.length > 0) {
      lines.push('');
      lines.push('⚠️ Circular References Detected:');
      tree.circularReferences.forEach((cpid: string) => {
        lines.push(`   - ${cpid}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Recursively render tree nodes
   */
  private renderTreeNode(node: any, lines: string[], prefix: string, isLast: boolean): void {
    const connector = isLast ? '└── ' : '├── ';
    const stampInfo = node.metadata
      ? ` (ID: ${node.stampId}, Creator: ${node.metadata.creator?.substring(0, 20)}...)`
      : ` (ID: ${node.stampId})`;

    lines.push(`${prefix}${connector}📄 ${node.cpid}${stampInfo}`);

    if (node.metadata) {
      const childPrefix = prefix + (isLast ? '    ' : '│   ');
      lines.push(`${childPrefix}├─ Type: ${node.metadata.mimetype}`);
      lines.push(`${childPrefix}├─ Block: ${node.metadata.blockIndex}`);
      lines.push(`${childPrefix}└─ Supply: ${node.metadata.supply}`);
    }

    // Render children
    const newPrefix = prefix + (isLast ? '    ' : '│   ');
    node.children.forEach((child: any, index: number) => {
      const childIsLast = index === node.children.length - 1;
      this.renderTreeNode(child, lines, newPrefix, childIsLast);
    });
  }

  /**
   * Format dependency tree as Mermaid diagram
   */
  private formatAsMermaid(tree: any): string {
    const lines: string[] = [];

    lines.push('```mermaid');
    lines.push('graph TD');
    lines.push('');

    // Add nodes
    tree.nodes.forEach((node: any, cpid: string) => {
      const shortCpid = cpid.substring(0, 8) + '...';
      const nodeLabel = `${shortCpid}<br/>ID: ${node.stampId}`;
      lines.push(`    ${this.sanitizeMermaidId(cpid)}["${nodeLabel}"]`);
    });

    lines.push('');

    // Add edges
    tree.edges.forEach((edge: any) => {
      const fromId = this.sanitizeMermaidId(edge.from);
      const toId = this.sanitizeMermaidId(edge.to);
      lines.push(`    ${fromId} -->|${edge.type}| ${toId}`);
    });

    // Add circular reference warnings
    if (tree.circularReferences.length > 0) {
      lines.push('');
      lines.push('    %% Circular references detected:');
      tree.circularReferences.forEach((cpid: string) => {
        lines.push(`    %% - ${cpid}`);
      });
    }

    lines.push('```');
    lines.push('');
    lines.push(
      `**Graph Statistics:** ${tree.totalNodes} nodes, ${tree.edges.length} edges, max depth ${tree.maxDepth}`
    );

    return lines.join('\n');
  }

  /**
   * Format dependency tree as adjacency list
   */
  private formatAsGraph(tree: any): string {
    const lines: string[] = [];

    lines.push('📊 Dependency Graph (Adjacency List)');
    lines.push('====================================');
    lines.push('');

    tree.nodes.forEach((node: any, cpid: string) => {
      lines.push(`🔗 ${cpid} (ID: ${node.stampId}, Depth: ${node.depth})`);

      // Find outgoing edges
      const outgoingEdges = tree.edges.filter((edge: any) => edge.from === cpid);
      if (outgoingEdges.length > 0) {
        outgoingEdges.forEach((edge: any) => {
          lines.push(`   └─ ${edge.type} → ${edge.to}`);
        });
      } else {
        lines.push('   └─ (no dependencies)');
      }
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Sanitize CPID for Mermaid node IDs
   */
  private sanitizeMermaidId(cpid: string): string {
    return cpid.replace(/[^a-zA-Z0-9]/g, '_');
  }
}

/**
 * Tool for analyzing patterns across multiple stamps to identify common libraries and techniques
 */
export class AnalyzeStampPatternsTool extends BaseTool<
  z.input<typeof AnalyzeStampPatternsParamsSchema>,
  AnalyzeStampPatternsParams
> {
  public readonly name = 'analyze_stamp_patterns';
  public readonly schema = AnalyzeStampPatternsParamsSchema;

  public readonly description =
    'Analyze patterns across multiple recursive stamps to identify common libraries, frameworks, and coding techniques used in the ecosystem';

  public readonly inputSchema: MCPTool['inputSchema'] = {
    type: 'object',
    properties: {
      sample_size: {
        type: 'number',
        description: 'Number of stamps to analyze for patterns',
        default: 1000,
        minimum: 1,
        maximum: 10000,
      },
      pattern_types: {
        type: 'array',
        items: {
          type: 'string',
          enum: [
            'frameworks',
            'loading_strategies',
            'error_handling',
            'composition_patterns',
            'optimization_techniques',
            'all',
          ],
        },
        description: 'Types of patterns to analyze',
        default: ['all'],
      },
      complexity_analysis: {
        type: 'boolean',
        description: 'Include complexity analysis for discovered patterns',
        default: true,
      },
      min_occurrences: {
        type: 'number',
        description: 'Minimum number of occurrences to consider a pattern',
        default: 3,
        minimum: 2,
        maximum: 100,
      },
      include_examples: {
        type: 'boolean',
        description: 'Include code examples for each pattern',
        default: true,
      },
      sort_by: {
        type: 'string',
        enum: ['frequency', 'complexity', 'alphabetical'],
        description: 'How to sort the results',
        default: 'frequency',
      },
    },
    required: [],
  };

  constructor(apiClient?: StampchainClient) {
    super();
    this.apiClient = apiClient;
  }

  private apiClient?: StampchainClient;

  protected validateInput(
    input: z.input<typeof AnalyzeStampPatternsParamsSchema>
  ): AnalyzeStampPatternsParams {
    return AnalyzeStampPatternsParamsSchema.parse(input);
  }

  public async execute(
    params: AnalyzeStampPatternsParams,
    context?: ToolContext
  ): Promise<ToolResponse> {
    const logger = createLogger('AnalyzeStampPatternsTool');
    const startTime = Date.now();

    try {
      logger.info('Starting stamp pattern analysis', {
        sampleSize: params.sample_size,
        patternTypes: params.pattern_types,
        minOccurrences: params.min_occurrences,
      });

      // Initialize API client
      const apiClient = this.apiClient || new StampchainClient();

      // Get sample of stamps to analyze
      const stamps = await this.getSampleStamps(apiClient, params.sample_size, logger);
      logger.info(`Retrieved ${stamps.length} stamps for analysis`);

      // Analyze patterns across the stamps
      const patternAnalysis = await this.analyzePatterns(stamps, params, logger);

      // Generate recommendations based on patterns
      const recommendations = this.generateRecommendations(patternAnalysis.discovered_patterns);

      // Calculate trending patterns
      const trendingPatterns = this.calculateTrendingPatterns(patternAnalysis.discovered_patterns);

      // Build final result
      const result: StampPatternAnalysisResult = {
        analysis_metadata: {
          total_stamps_analyzed: stamps.length,
          analysis_date: new Date().toISOString(),
          pattern_types_analyzed: params.pattern_types,
          min_occurrences_threshold: params.min_occurrences,
          analysis_duration_ms: Date.now() - startTime,
        },
        discovered_patterns: patternAnalysis.discovered_patterns,
        pattern_categories: patternAnalysis.pattern_categories,
        trending_patterns: trendingPatterns,
        recommendations: recommendations,
        statistics: patternAnalysis.statistics,
      };

      logger.info('Pattern analysis completed', {
        patternsFound: result.statistics.total_patterns_found,
        categoriesAnalyzed: result.pattern_categories.length,
        duration: result.analysis_metadata.analysis_duration_ms,
      });

      return multiResponse(
        { type: 'text', text: this.formatPatternAnalysisReport(result) },
        { type: 'text', text: JSON.stringify(result, null, 2) }
      );
    } catch (error) {
      logger.error('Pattern analysis failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ToolExecutionError(
        `Failed to analyze stamp patterns: ${error instanceof Error ? error.message : String(error)}`,
        'PATTERN_ANALYSIS_ERROR',
        { originalError: error }
      );
    }
  }

  /**
   * Get a sample of stamps for pattern analysis
   */
  private async getSampleStamps(
    apiClient: StampchainClient,
    sampleSize: number,
    logger: any
  ): Promise<any[]> {
    try {
      // Get recent stamps with pagination
      const stamps: any[] = [];
      let page = 1;
      const pageSize = Math.min(sampleSize, 100); // Use smaller page size

      while (stamps.length < sampleSize) {
        const response = await apiClient.searchStamps({
          page,
          limit: Math.min(pageSize, sampleSize - stamps.length),
          sort_order: 'DESC',
        });

        if (!response || response.length === 0) {
          break;
        }

        stamps.push(...response);
        page++;

        // Avoid infinite loops
        if (page > 100) {
          logger.warn('Reached maximum page limit while collecting stamps');
          break;
        }
      }

      return stamps.slice(0, sampleSize);
    } catch (error) {
      logger.error('Failed to retrieve stamps for analysis', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Analyze patterns across the stamp collection
   */
  private async analyzePatterns(
    stamps: any[],
    params: AnalyzeStampPatternsParams,
    logger: any
  ): Promise<{
    discovered_patterns: PatternUsageStats[];
    pattern_categories: Array<{
      category: string;
      pattern_count: number;
      total_occurrences: number;
      average_complexity: number;
    }>;
    statistics: {
      total_patterns_found: number;
      most_common_pattern: string;
      average_pattern_complexity: number;
      patterns_by_category: Record<string, number>;
    };
  }> {
    const patternMap = new Map<string, PatternUsageStats>();
    const parser = new RecursiveStampParser();

    logger.info('Analyzing patterns across stamps', { totalStamps: stamps.length });

    for (const stamp of stamps) {
      try {
        // Skip if no stamp content
        if (!stamp.stamp_base64) {
          continue;
        }

        // Decode and analyze the stamp content
        const content = Buffer.from(stamp.stamp_base64, 'base64').toString('utf-8');

        // Detect patterns in this stamp
        const detectedPatterns = await this.detectPatternsInStamp(content, stamp, parser, params);

        // Update pattern statistics
        for (const pattern of detectedPatterns) {
          const existing = patternMap.get(pattern.pattern_id);
          if (existing) {
            existing.occurrences++;
            existing.examples.push({
              stamp_id: stamp.stamp,
              cpid: stamp.cpid || `A${stamp.stamp}`,
              code_snippet: pattern.code_snippet,
              variation_notes: pattern.variation_notes,
            });
            existing.last_seen = new Date().toISOString();
          } else {
            patternMap.set(pattern.pattern_id, {
              pattern_id: pattern.pattern_id,
              pattern_name: pattern.pattern_name,
              description: pattern.description,
              category: pattern.category,
              occurrences: 1,
              frequency_percentage: 0, // Will calculate later
              complexity_score: pattern.complexity_score,
              first_seen: new Date().toISOString(),
              last_seen: new Date().toISOString(),
              examples: [
                {
                  stamp_id: stamp.stamp,
                  cpid: stamp.cpid || `A${stamp.stamp}`,
                  code_snippet: pattern.code_snippet,
                  variation_notes: pattern.variation_notes,
                },
              ],
              variations: [],
            });
          }
        }
      } catch (error) {
        logger.warn('Failed to analyze stamp for patterns', {
          stampId: stamp.stamp,
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
    }

    // Filter patterns by minimum occurrences
    const filteredPatterns = Array.from(patternMap.values()).filter(
      (pattern) => pattern.occurrences >= params.min_occurrences
    );

    // Calculate frequency percentages
    const totalStamps = stamps.length;
    filteredPatterns.forEach((pattern) => {
      pattern.frequency_percentage = (pattern.occurrences / totalStamps) * 100;
    });

    // Sort patterns
    this.sortPatterns(filteredPatterns, params.sort_by);

    // Limit examples if requested
    if (!params.include_examples) {
      filteredPatterns.forEach((pattern) => {
        pattern.examples = [];
      });
    } else {
      // Limit to top 5 examples per pattern
      filteredPatterns.forEach((pattern) => {
        pattern.examples = pattern.examples.slice(0, 5);
      });
    }

    // Calculate category statistics
    const categoryStats = this.calculateCategoryStats(filteredPatterns);

    // Calculate overall statistics
    const statistics = this.calculateOverallStats(filteredPatterns);

    return {
      discovered_patterns: filteredPatterns,
      pattern_categories: categoryStats,
      statistics,
    };
  }

  /**
   * Detect patterns in a single stamp
   */
  private async detectPatternsInStamp(
    content: string,
    stamp: any,
    parser: RecursiveStampParser,
    params: AnalyzeStampPatternsParams
  ): Promise<
    Array<{
      pattern_id: string;
      pattern_name: string;
      description: string;
      category: string;
      complexity_score: number;
      code_snippet: string;
      variation_notes?: string;
    }>
  > {
    const patterns: Array<{
      pattern_id: string;
      pattern_name: string;
      description: string;
      category: string;
      complexity_score: number;
      code_snippet: string;
      variation_notes?: string;
    }> = [];

    const shouldAnalyze = (
      category:
        | 'frameworks'
        | 'loading_strategies'
        | 'error_handling'
        | 'composition_patterns'
        | 'optimization_techniques'
    ) => params.pattern_types.includes('all') || params.pattern_types.includes(category);

    // Framework detection
    if (shouldAnalyze('frameworks')) {
      if (content.includes('Append') && content.includes('t.js(') && content.includes('t.html(')) {
        patterns.push({
          pattern_id: 'append_framework',
          pattern_name: 'Append Framework',
          description: 'Uses the Append framework for modular stamp composition',
          category: 'frameworks',
          complexity_score: 6,
          code_snippet: this.extractCodeSnippet(content, 'Append'),
        });
      }

      if (content.includes('React') || content.includes('createElement')) {
        patterns.push({
          pattern_id: 'react_framework',
          pattern_name: 'React Framework',
          description: 'Uses React for component-based UI development',
          category: 'frameworks',
          complexity_score: 8,
          code_snippet: this.extractCodeSnippet(content, 'React'),
        });
      }

      if (content.includes('Vue') || content.includes('createApp')) {
        patterns.push({
          pattern_id: 'vue_framework',
          pattern_name: 'Vue Framework',
          description: 'Uses Vue.js for reactive UI development',
          category: 'frameworks',
          complexity_score: 7,
          code_snippet: this.extractCodeSnippet(content, 'Vue'),
        });
      }
    }

    // Loading strategy detection
    if (shouldAnalyze('loading_strategies')) {
      if (content.includes('/s/') && content.includes('script')) {
        patterns.push({
          pattern_id: 'dynamic_script_loading',
          pattern_name: 'Dynamic Script Loading',
          description: 'Dynamically loads JavaScript from other stamps',
          category: 'loading_strategies',
          complexity_score: 5,
          code_snippet: this.extractCodeSnippet(content, '/s/'),
        });
      }

      if (content.includes('async') && content.includes('await')) {
        patterns.push({
          pattern_id: 'async_loading',
          pattern_name: 'Asynchronous Loading',
          description: 'Uses async/await for non-blocking resource loading',
          category: 'loading_strategies',
          complexity_score: 4,
          code_snippet: this.extractCodeSnippet(content, 'async'),
        });
      }

      if (
        content.includes('Promise') &&
        (content.includes('.then(') || content.includes('.catch('))
      ) {
        patterns.push({
          pattern_id: 'promise_based_loading',
          pattern_name: 'Promise-based Loading',
          description: 'Uses Promises for asynchronous resource management',
          category: 'loading_strategies',
          complexity_score: 5,
          code_snippet: this.extractCodeSnippet(content, 'Promise'),
        });
      }
    }

    // Error handling detection
    if (shouldAnalyze('error_handling')) {
      if (content.includes('try') && content.includes('catch')) {
        patterns.push({
          pattern_id: 'try_catch_error_handling',
          pattern_name: 'Try-Catch Error Handling',
          description: 'Uses try-catch blocks for error management',
          category: 'error_handling',
          complexity_score: 3,
          code_snippet: this.extractCodeSnippet(content, 'try'),
        });
      }

      if (content.includes('.error(') || content.includes('console.error')) {
        patterns.push({
          pattern_id: 'console_error_logging',
          pattern_name: 'Console Error Logging',
          description: 'Logs errors to console for debugging',
          category: 'error_handling',
          complexity_score: 2,
          code_snippet: this.extractCodeSnippet(content, 'error'),
        });
      }

      if (content.includes('onerror') || content.includes("addEventListener('error'")) {
        patterns.push({
          pattern_id: 'global_error_handling',
          pattern_name: 'Global Error Handling',
          description: 'Implements global error handlers',
          category: 'error_handling',
          complexity_score: 4,
          code_snippet: this.extractCodeSnippet(content, 'onerror'),
        });
      }
    }

    // Composition patterns
    if (shouldAnalyze('composition_patterns')) {
      const cpidMatches = content.match(/A\d{19}/g);
      if (cpidMatches && cpidMatches.length > 1) {
        patterns.push({
          pattern_id: 'multi_stamp_composition',
          pattern_name: 'Multi-Stamp Composition',
          description: 'Composes multiple stamps into a single artwork',
          category: 'composition_patterns',
          complexity_score: 7,
          code_snippet: this.extractCodeSnippet(content, cpidMatches[0]),
          variation_notes: `References ${cpidMatches.length} other stamps`,
        });
      }

      if (content.includes('createElement') && content.includes('appendChild')) {
        patterns.push({
          pattern_id: 'dom_manipulation',
          pattern_name: 'DOM Manipulation',
          description: 'Dynamically creates and modifies DOM elements',
          category: 'composition_patterns',
          complexity_score: 5,
          code_snippet: this.extractCodeSnippet(content, 'createElement'),
        });
      }

      if (content.includes('innerHTML') || content.includes('textContent')) {
        patterns.push({
          pattern_id: 'content_injection',
          pattern_name: 'Content Injection',
          description: 'Injects content into existing DOM elements',
          category: 'composition_patterns',
          complexity_score: 3,
          code_snippet: this.extractCodeSnippet(content, 'innerHTML'),
        });
      }
    }

    // Optimization techniques
    if (shouldAnalyze('optimization_techniques')) {
      if (content.includes('requestAnimationFrame')) {
        patterns.push({
          pattern_id: 'animation_frame_optimization',
          pattern_name: 'Animation Frame Optimization',
          description: 'Uses requestAnimationFrame for smooth animations',
          category: 'optimization_techniques',
          complexity_score: 6,
          code_snippet: this.extractCodeSnippet(content, 'requestAnimationFrame'),
        });
      }

      if (content.includes('debounce') || content.includes('throttle')) {
        patterns.push({
          pattern_id: 'performance_throttling',
          pattern_name: 'Performance Throttling',
          description: 'Uses debouncing or throttling for performance optimization',
          category: 'optimization_techniques',
          complexity_score: 5,
          code_snippet: this.extractCodeSnippet(content, 'debounce'),
        });
      }

      if (content.includes('lazy') || content.includes('defer')) {
        patterns.push({
          pattern_id: 'lazy_loading',
          pattern_name: 'Lazy Loading',
          description: 'Implements lazy loading for better performance',
          category: 'optimization_techniques',
          complexity_score: 4,
          code_snippet: this.extractCodeSnippet(content, 'lazy'),
        });
      }
    }

    return patterns;
  }

  /**
   * Extract a relevant code snippet around a keyword
   */
  private extractCodeSnippet(content: string, keyword: string, maxLength: number = 200): string {
    const index = content.indexOf(keyword);
    if (index === -1) return '';

    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + maxLength);
    const snippet = content.substring(start, end);

    return snippet.trim();
  }

  /**
   * Sort patterns according to the specified criteria
   */
  private sortPatterns(patterns: PatternUsageStats[], sortBy: string): void {
    switch (sortBy) {
      case 'frequency':
        patterns.sort((a, b) => b.occurrences - a.occurrences);
        break;
      case 'complexity':
        patterns.sort((a, b) => b.complexity_score - a.complexity_score);
        break;
      case 'alphabetical':
        patterns.sort((a, b) => a.pattern_name.localeCompare(b.pattern_name));
        break;
    }
  }

  /**
   * Calculate category statistics
   */
  private calculateCategoryStats(patterns: PatternUsageStats[]): Array<{
    category: string;
    pattern_count: number;
    total_occurrences: number;
    average_complexity: number;
  }> {
    const categoryMap = new Map<
      string,
      { patterns: PatternUsageStats[]; totalOccurrences: number }
    >();

    for (const pattern of patterns) {
      if (!categoryMap.has(pattern.category)) {
        categoryMap.set(pattern.category, { patterns: [], totalOccurrences: 0 });
      }
      const categoryData = categoryMap.get(pattern.category)!;
      categoryData.patterns.push(pattern);
      categoryData.totalOccurrences += pattern.occurrences;
    }

    return Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      pattern_count: data.patterns.length,
      total_occurrences: data.totalOccurrences,
      average_complexity:
        data.patterns.reduce((sum, p) => sum + p.complexity_score, 0) / data.patterns.length,
    }));
  }

  /**
   * Calculate overall statistics
   */
  private calculateOverallStats(patterns: PatternUsageStats[]): {
    total_patterns_found: number;
    most_common_pattern: string;
    average_pattern_complexity: number;
    patterns_by_category: Record<string, number>;
  } {
    const mostCommon = patterns.length > 0 ? patterns[0] : null;
    const avgComplexity =
      patterns.length > 0
        ? patterns.reduce((sum, p) => sum + p.complexity_score, 0) / patterns.length
        : 0;

    const patternsByCategory: Record<string, number> = {};
    for (const pattern of patterns) {
      patternsByCategory[pattern.category] = (patternsByCategory[pattern.category] || 0) + 1;
    }

    return {
      total_patterns_found: patterns.length,
      most_common_pattern: mostCommon?.pattern_name || 'None',
      average_pattern_complexity: avgComplexity,
      patterns_by_category: patternsByCategory,
    };
  }

  /**
   * Generate recommendations based on discovered patterns
   */
  private generateRecommendations(patterns: PatternUsageStats[]): Array<{
    type: 'beginner_friendly' | 'advanced' | 'performance' | 'security';
    pattern_id: string;
    reason: string;
    difficulty_level: number;
  }> {
    const recommendations: Array<{
      type: 'beginner_friendly' | 'advanced' | 'performance' | 'security';
      pattern_id: string;
      reason: string;
      difficulty_level: number;
    }> = [];

    for (const pattern of patterns) {
      // Beginner-friendly patterns
      if (pattern.complexity_score <= 3 && pattern.frequency_percentage > 10) {
        recommendations.push({
          type: 'beginner_friendly',
          pattern_id: pattern.pattern_id,
          reason: `Common pattern with low complexity (${pattern.complexity_score}/10) used in ${pattern.frequency_percentage.toFixed(1)}% of stamps`,
          difficulty_level: pattern.complexity_score,
        });
      }

      // Advanced patterns
      if (pattern.complexity_score >= 7) {
        recommendations.push({
          type: 'advanced',
          pattern_id: pattern.pattern_id,
          reason: `High complexity pattern (${pattern.complexity_score}/10) for experienced developers`,
          difficulty_level: pattern.complexity_score,
        });
      }

      // Performance patterns
      if (pattern.category === 'optimization_techniques') {
        recommendations.push({
          type: 'performance',
          pattern_id: pattern.pattern_id,
          reason: 'Optimization technique that can improve stamp performance',
          difficulty_level: pattern.complexity_score,
        });
      }

      // Security patterns
      if (pattern.category === 'error_handling') {
        recommendations.push({
          type: 'security',
          pattern_id: pattern.pattern_id,
          reason: 'Error handling pattern that improves stamp reliability and security',
          difficulty_level: pattern.complexity_score,
        });
      }
    }

    return recommendations.slice(0, 10); // Limit to top 10 recommendations
  }

  /**
   * Calculate trending patterns (simplified version)
   */
  private calculateTrendingPatterns(patterns: PatternUsageStats[]): Array<{
    pattern_id: string;
    growth_rate: number;
    recent_adoptions: number;
  }> {
    // For now, return patterns with high frequency as "trending"
    // In a real implementation, this would analyze timestamps and growth rates
    return patterns
      .filter((p) => p.frequency_percentage > 5)
      .slice(0, 5)
      .map((pattern) => ({
        pattern_id: pattern.pattern_id,
        growth_rate: pattern.frequency_percentage, // Simplified
        recent_adoptions: Math.floor(pattern.occurrences * 0.3), // Simplified
      }));
  }

  /**
   * Format the pattern analysis report for human readability
   */
  private formatPatternAnalysisReport(result: StampPatternAnalysisResult): string {
    const report = [
      '# Recursive Stamp Pattern Analysis Report',
      '',
      `**Analysis Date:** ${result.analysis_metadata.analysis_date}`,
      `**Stamps Analyzed:** ${result.analysis_metadata.total_stamps_analyzed}`,
      `**Analysis Duration:** ${result.analysis_metadata.analysis_duration_ms}ms`,
      `**Pattern Types:** ${result.analysis_metadata.pattern_types_analyzed.join(', ')}`,
      `**Minimum Occurrences:** ${result.analysis_metadata.min_occurrences_threshold}`,
      '',
      '## 📊 Summary Statistics',
      '',
      `- **Total Patterns Found:** ${result.statistics.total_patterns_found}`,
      `- **Most Common Pattern:** ${result.statistics.most_common_pattern}`,
      `- **Average Complexity:** ${result.statistics.average_pattern_complexity.toFixed(1)}/10`,
      '',
      '### Patterns by Category:',
      ...Object.entries(result.statistics.patterns_by_category).map(
        ([category, count]) => `- **${category}:** ${count} patterns`
      ),
      '',
      '## 🔍 Discovered Patterns',
      '',
    ];

    // Add top patterns
    const topPatterns = result.discovered_patterns.slice(0, 10);
    for (const pattern of topPatterns) {
      report.push(
        `### ${pattern.pattern_name}`,
        `**Category:** ${pattern.category}`,
        `**Occurrences:** ${pattern.occurrences} (${pattern.frequency_percentage.toFixed(1)}%)`,
        `**Complexity:** ${pattern.complexity_score}/10`,
        `**Description:** ${pattern.description}`,
        ''
      );

      if (pattern.examples.length > 0) {
        report.push('**Examples:**');
        for (const example of pattern.examples.slice(0, 2)) {
          report.push(`- Stamp ${example.cpid}: \`${example.code_snippet.substring(0, 100)}...\``);
        }
        report.push('');
      }
    }

    // Add category breakdown
    report.push('## 📈 Category Analysis', '');

    for (const category of result.pattern_categories) {
      report.push(
        `### ${category.category}`,
        `- **Patterns:** ${category.pattern_count}`,
        `- **Total Occurrences:** ${category.total_occurrences}`,
        `- **Average Complexity:** ${category.average_complexity.toFixed(1)}/10`,
        ''
      );
    }

    // Add recommendations
    if (result.recommendations.length > 0) {
      report.push('## 💡 Recommendations', '');

      const recsByType = result.recommendations.reduce(
        (acc, rec) => {
          if (!acc[rec.type]) acc[rec.type] = [];
          acc[rec.type].push(rec);
          return acc;
        },
        {} as Record<string, typeof result.recommendations>
      );

      for (const [type, recs] of Object.entries(recsByType)) {
        report.push(`### ${type.replace('_', ' ').toUpperCase()}`);
        for (const rec of recs.slice(0, 3)) {
          const pattern = result.discovered_patterns.find((p) => p.pattern_id === rec.pattern_id);
          report.push(`- **${pattern?.pattern_name || rec.pattern_id}**: ${rec.reason}`);
        }
        report.push('');
      }
    }

    // Add trending patterns
    if (result.trending_patterns.length > 0) {
      report.push('## 🚀 Trending Patterns', '');

      for (const trending of result.trending_patterns) {
        const pattern = result.discovered_patterns.find(
          (p) => p.pattern_id === trending.pattern_id
        );
        report.push(
          `- **${pattern?.pattern_name || trending.pattern_id}**: ${trending.growth_rate.toFixed(1)}% adoption, ${trending.recent_adoptions} recent uses`
        );
      }
      report.push('');
    }

    return report.join('\n');
  }
}

/**
 * Export all stamp analysis tools
 */
export const stampAnalysisTools = {
  analyze_stamp_code: AnalyzeStampCodeTool,
  get_stamp_dependencies: GetStampDependenciesTool,
  analyze_stamp_patterns: AnalyzeStampPatternsTool,
};

/**
 * Factory function to create stamp analysis tool instances
 */
export function createStampAnalysisTools(apiClient?: StampchainClient) {
  return {
    analyze_stamp_code: new AnalyzeStampCodeTool(apiClient),
    get_stamp_dependencies: new GetStampDependenciesTool(apiClient),
    analyze_stamp_patterns: new AnalyzeStampPatternsTool(apiClient),
  };
}
