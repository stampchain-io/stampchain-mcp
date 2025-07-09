/**
 * Type definitions and Zod schemas for recursive stamp analysis
 */

import { z } from 'zod';

// Core analysis result types
export const StampDependencySchema = z.object({
  cpid: z.string(),
  type: z.enum(['javascript', 'html', 'script_src', 'unknown']),
  loadMethod: z.enum(['t.js', 't.html', 'script_tag', 'other']),
  isResolved: z.boolean(),
  stampId: z.number().optional(),
  metadata: z.any().optional(), // Will be Stamp type from API
});

export const DetectedPatternSchema = z.object({
  name: z.string(),
  confidence: z.number().min(0).max(1),
  category: z.enum(['framework', 'pattern', 'technique', 'library']),
  description: z.string(),
  matches: z.array(z.string()).optional(),
});

export const CodeStructureSchema = z.object({
  hasJavaScript: z.boolean(),
  hasHTML: z.boolean(),
  usesAppendFramework: z.boolean(),
  isRecursive: z.boolean(),
  hasAsyncLoading: z.boolean(),
  hasErrorHandling: z.boolean(),
});

export const SecurityAnalysisSchema = z.object({
  riskLevel: z.enum(['low', 'medium', 'high']),
  risks: z.array(z.string()),
  hasDangerousPatterns: z.boolean(),
  isCodeSafe: z.boolean(),
});

export const PerformanceAnalysisSchema = z.object({
  complexityScore: z.number().min(0).max(10),
  dependencyCount: z.number(),
  maxDependencyDepth: z.number(),
  estimatedLoadTime: z.number().optional(),
});

export const StampAnalysisResultSchema = z.object({
  stamp: z.object({
    id: z.number(),
    cpid: z.string(),
    creator: z.string(),
    mimetype: z.string(),
    blockIndex: z.number(),
    txHash: z.string(),
  }),
  codeStructure: CodeStructureSchema,
  dependencies: z.array(StampDependencySchema),
  patterns: z.array(DetectedPatternSchema),
  security: SecurityAnalysisSchema,
  performance: PerformanceAnalysisSchema,
  rawContent: z.string().optional(),
  decodedContent: z.string().optional(),
  analysisTimestamp: z.number(),
});

// Dependency graph types
export const DependencyGraphNodeSchema = z.object({
  stampId: z.number(),
  cpid: z.string(),
  creator: z.string(),
  mimetype: z.string(),
  isRecursive: z.boolean(),
  depth: z.number(),
});

export const DependencyGraphEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  type: z.enum(['javascript', 'html', 'script_src', 'unknown']),
  loadMethod: z.enum(['t.js', 't.html', 'script_tag', 'other']),
});

export const DependencyGraphSchema = z.object({
  nodes: z.map(z.string(), DependencyGraphNodeSchema),
  edges: z.array(DependencyGraphEdgeSchema),
  metadata: z.object({
    rootStampId: z.number(),
    maxDepth: z.number(),
    totalNodes: z.number(),
    totalEdges: z.number(),
    analysisTimestamp: z.number(),
  }),
});

// Library usage analysis
export const LibraryUsageSchema = z.object({
  cpid: z.string(),
  stampId: z.number().optional(),
  usageCount: z.number(),
  usedBy: z.array(z.number()),
  metadata: z.any().optional(),
});

export const LibraryUsageReportSchema = z.object({
  totalLibraries: z.number(),
  mostUsedLibraries: z.array(LibraryUsageSchema),
  libraryUsage: z.array(LibraryUsageSchema),
  analysisTimestamp: z.number(),
});

// MCP tool parameter schemas
export const AnalyzeStampCodeParamsSchema = z.object({
  stamp_id: z.union([z.number(), z.string()]),
  include_dependencies: z.boolean().default(true),
  max_depth: z.number().min(1).max(10).default(3),
  include_raw_content: z.boolean().default(false),
  include_security_analysis: z.boolean().default(true),
  include_performance_analysis: z.boolean().default(true),
});

export const BuildDependencyGraphParamsSchema = z.object({
  stamp_id: z.union([z.number(), z.string()]),
  max_depth: z.number().min(1).max(10).default(3),
  include_metadata: z.boolean().default(true),
  format: z.enum(['json', 'mermaid']).default('json'),
});

export const AnalyzeLibraryUsageParamsSchema = z.object({
  stamp_ids: z.array(z.union([z.number(), z.string()])).optional(),
  creator: z.string().optional(),
  limit: z.number().min(1).max(1000).default(100),
  include_metadata: z.boolean().default(false),
});

/**
 * Schema for get_stamp_dependencies parameters
 */
export const GetStampDependenciesParamsSchema = z.object({
  stamp_id: z
    .union([z.number(), z.string()])
    .describe('The ID or CPID of the stamp to map dependencies for'),
  max_depth: z
    .number()
    .min(1)
    .max(10)
    .default(5)
    .describe('Maximum depth to traverse dependencies'),
  include_metadata: z
    .boolean()
    .default(true)
    .describe('Include full stamp metadata for each dependency'),
  format: z
    .enum(['tree', 'graph', 'mermaid', 'json'])
    .default('tree')
    .describe('Output format for the dependency structure'),
  resolve_all: z
    .boolean()
    .default(true)
    .describe('Attempt to resolve all dependencies (may be slow for deep graphs)'),
});

// Type exports
export type StampDependency = z.infer<typeof StampDependencySchema>;
export type DetectedPattern = z.infer<typeof DetectedPatternSchema>;
export type CodeStructure = z.infer<typeof CodeStructureSchema>;
export type SecurityAnalysis = z.infer<typeof SecurityAnalysisSchema>;
export type PerformanceAnalysis = z.infer<typeof PerformanceAnalysisSchema>;
export type StampAnalysisResult = z.infer<typeof StampAnalysisResultSchema>;

export type DependencyGraphNode = z.infer<typeof DependencyGraphNodeSchema>;
export type DependencyGraphEdge = z.infer<typeof DependencyGraphEdgeSchema>;
export type DependencyGraph = z.infer<typeof DependencyGraphSchema>;

export type LibraryUsage = z.infer<typeof LibraryUsageSchema>;
export type LibraryUsageReport = z.infer<typeof LibraryUsageReportSchema>;

export type AnalyzeStampCodeParams = z.infer<typeof AnalyzeStampCodeParamsSchema>;
export type BuildDependencyGraphParams = z.infer<typeof BuildDependencyGraphParamsSchema>;
export type AnalyzeLibraryUsageParams = z.infer<typeof AnalyzeLibraryUsageParamsSchema>;

export type GetStampDependenciesParams = z.infer<typeof GetStampDependenciesParamsSchema>;

/**
 * Extended dependency graph node for tree visualization
 */
export interface DependencyTreeNode {
  cpid: string;
  stampId: number;
  depth: number;
  children: DependencyTreeNode[];
  metadata?: {
    creator?: string;
    mimetype?: string;
    blockIndex?: number;
    txHash?: string;
    supply?: number;
    locked?: boolean;
  };
}

/**
 * Complete dependency tree structure for visualization
 */
export interface DependencyTree {
  root: DependencyTreeNode;
  nodes: Map<string, DependencyTreeNode>;
  edges: Array<{
    from: string;
    to: string;
    type: string;
  }>;
  totalNodes: number;
  maxDepth: number;
  circularReferences: string[];
}

// Pattern definition type (for internal use)
export interface PatternDefinition {
  name: string;
  regex: RegExp;
  confidence: number;
  category: 'framework' | 'pattern' | 'technique' | 'library';
  description: string;
}

// Parsed JavaScript result (for internal use)
export interface ParsedJavaScript {
  dependencies: StampDependency[];
  patterns: DetectedPattern[];
  usesAppendFramework: boolean;
  hasAsyncLoading: boolean;
  hasErrorHandling: boolean;
  codeStructure: {
    functions: string[];
    variables: string[];
    imports: string[];
  };
}

/**
 * Schema for analyze_stamp_patterns parameters
 */
export const AnalyzeStampPatternsParamsSchema = z.object({
  sample_size: z
    .number()
    .min(1)
    .max(10000)
    .default(1000)
    .describe('Number of stamps to analyze for patterns'),
  pattern_types: z
    .array(
      z.enum([
        'frameworks',
        'loading_strategies',
        'error_handling',
        'composition_patterns',
        'optimization_techniques',
        'all',
      ])
    )
    .default(['all'])
    .describe('Types of patterns to analyze'),
  complexity_analysis: z
    .boolean()
    .default(true)
    .describe('Include complexity analysis for discovered patterns'),
  min_occurrences: z
    .number()
    .min(2)
    .max(100)
    .default(3)
    .describe('Minimum number of occurrences to consider a pattern'),
  include_examples: z.boolean().default(true).describe('Include code examples for each pattern'),
  sort_by: z
    .enum(['frequency', 'complexity', 'alphabetical'])
    .default('frequency')
    .describe('How to sort the results'),
});

export type AnalyzeStampPatternsParams = z.infer<typeof AnalyzeStampPatternsParamsSchema>;

/**
 * Pattern usage statistics
 */
export interface PatternUsageStats {
  pattern_id: string;
  pattern_name: string;
  description: string;
  category: string;
  occurrences: number;
  frequency_percentage: number;
  complexity_score: number;
  first_seen: string;
  last_seen: string;
  examples: Array<{
    stamp_id: string;
    cpid: string;
    code_snippet: string;
    variation_notes?: string;
  }>;
  variations: Array<{
    variation_id: string;
    description: string;
    occurrences: number;
    examples: string[];
  }>;
}

/**
 * Pattern analysis result
 */
export interface StampPatternAnalysisResult {
  analysis_metadata: {
    total_stamps_analyzed: number;
    analysis_date: string;
    pattern_types_analyzed: string[];
    min_occurrences_threshold: number;
    analysis_duration_ms: number;
  };
  discovered_patterns: PatternUsageStats[];
  pattern_categories: Array<{
    category: string;
    pattern_count: number;
    total_occurrences: number;
    average_complexity: number;
  }>;
  trending_patterns: Array<{
    pattern_id: string;
    growth_rate: number;
    recent_adoptions: number;
  }>;
  recommendations: Array<{
    type: 'beginner_friendly' | 'advanced' | 'performance' | 'security';
    pattern_id: string;
    reason: string;
    difficulty_level: number;
  }>;
  statistics: {
    total_patterns_found: number;
    most_common_pattern: string;
    average_pattern_complexity: number;
    patterns_by_category: Record<string, number>;
  };
}
