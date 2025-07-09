/**
 * Recursive stamp analysis MCP tool
 * Analyzes stamp code structure, dependencies, and patterns
 */

import type { z } from 'zod';
import type { Tool as MCPTool } from '@modelcontextprotocol/sdk/types.js';
import type { ToolResponse, ToolContext } from '../interfaces/tool.js';
import { textResponse, multiResponse, BaseTool } from '../interfaces/tool.js';
import { ToolExecutionError, ValidationError } from '../utils/errors.js';
import { StampchainClient } from '../api/stampchain-client.js';
import { RecursiveStampParser } from '../utils/recursive-parser.js';
import { parseStampId, isStampIdentifier } from '../utils/validators.js';
import { createLogger } from '../utils/logger.js';
import type { Stamp } from '../api/types.js';
import {
  AnalyzeStampCodeParamsSchema,
  GetStampDependenciesParamsSchema,
  type AnalyzeStampCodeParams,
  type GetStampDependenciesParams,
  type StampAnalysisResult,
  type StampDependency,
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
      context?.logger?.error('Error executing analyze_stamp_code tool', { error });

      if (error instanceof ValidationError) {
        throw error;
      }

      if (error instanceof ToolExecutionError) {
        throw error;
      }

      // Pass through the original error message for API errors
      if (error instanceof Error) {
        throw new ToolExecutionError(error.message, this.name, error);
      }

      throw new ToolExecutionError('Failed to analyze stamp code', this.name, error);
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
 * Export all stamp analysis tools
 */
export const stampAnalysisTools = {
  analyze_stamp_code: AnalyzeStampCodeTool,
  get_stamp_dependencies: GetStampDependenciesTool,
};

/**
 * Factory function to create stamp analysis tool instances
 */
export function createStampAnalysisTools(apiClient?: StampchainClient) {
  return {
    analyze_stamp_code: new AnalyzeStampCodeTool(apiClient),
    get_stamp_dependencies: new GetStampDependenciesTool(apiClient),
  };
}
