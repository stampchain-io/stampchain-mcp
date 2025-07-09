/**
 * Tool Registry System for MCP Server
 * Manages registration, discovery, and validation of MCP tools
 */

import type { ITool } from '../interfaces/tool.js';
import { isTool } from '../interfaces/tool.js';
import { createLogger, ToolNotFoundError, InvalidParametersError } from '../utils/index.js';
import type { Tool as MCPTool } from '@modelcontextprotocol/sdk/types.js';

const logger = createLogger('tool-registry');

/**
 * Tool metadata stored in the registry
 */
export interface RegisteredTool {
  tool: ITool;
  registeredAt: Date;
  version: string;
  enabled: boolean;
}

/**
 * Tool registry configuration options
 */
export interface ToolRegistryOptions {
  allowDuplicateNames?: boolean;
  validateOnRegister?: boolean;
  maxTools?: number;
}

/**
 * Tool Registry class for managing MCP tools
 */
export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();
  private toolsByCategory: Map<string, Set<string>> = new Map();
  private options: Required<ToolRegistryOptions>;

  constructor(options: ToolRegistryOptions = {}) {
    this.options = {
      allowDuplicateNames: false,
      validateOnRegister: true,
      maxTools: 1000,
      ...options,
    };

    logger.info('Tool registry initialized', { options: this.options });
  }

  /**
   * Register a new tool
   * @param tool The tool to register
   * @param options Additional registration options
   * @returns The registered tool name
   * @throws {InvalidParametersError} if validation fails
   */
  public register(
    tool: ITool,
    options?: { version?: string; category?: string; force?: boolean }
  ): string {
    const { version = '1.0.0', category, force = false } = options || {};

    // Validate tool implementation
    if (this.options.validateOnRegister && !isTool(tool)) {
      throw new InvalidParametersError('Invalid tool implementation', [
        `Tool: ${(tool as any)?.name || 'unknown'}`,
      ]);
    }

    // Check for duplicate names
    if (!this.options.allowDuplicateNames && this.tools.has(tool.name) && !force) {
      throw new InvalidParametersError(`Tool with name '${tool.name}' already registered`, [
        `Tool: ${tool.name}`,
      ]);
    }

    // Check max tools limit
    if (this.tools.size >= this.options.maxTools && !this.tools.has(tool.name)) {
      throw new InvalidParametersError(
        `Maximum number of tools (${this.options.maxTools}) reached`
      );
    }

    // Register the tool
    this.tools.set(tool.name, {
      tool,
      registeredAt: new Date(),
      version,
      enabled: true,
    });

    // Add to category if provided
    if (category) {
      if (!this.toolsByCategory.has(category)) {
        this.toolsByCategory.set(category, new Set());
      }
      this.toolsByCategory.get(category)!.add(tool.name);
    }

    logger.info('Tool registered', {
      name: tool.name,
      version,
      category,
      totalTools: this.tools.size,
    });

    return tool.name;
  }

  /**
   * Register multiple tools at once
   * @param tools Array of tools to register
   * @param options Registration options for all tools
   * @returns Array of registered tool names
   */
  public registerMany(
    tools: ITool[],
    options?: { version?: string; category?: string; force?: boolean }
  ): string[] {
    const registered: string[] = [];

    for (const tool of tools) {
      try {
        const name = this.register(tool, options);
        registered.push(name);
      } catch (error) {
        logger.error('Failed to register tool', {
          toolName: tool.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return registered;
  }

  /**
   * Unregister a tool
   * @param name The tool name to unregister
   * @returns True if the tool was unregistered
   */
  public unregister(name: string): boolean {
    const removed = this.tools.delete(name);

    if (removed) {
      // Remove from categories
      for (const [category, toolNames] of this.toolsByCategory) {
        if (toolNames.delete(name) && toolNames.size === 0) {
          this.toolsByCategory.delete(category);
        }
      }

      logger.info('Tool unregistered', { name });
    }

    return removed;
  }

  /**
   * Remove a tool (alias for unregister)
   * @param name The tool name to remove
   * @returns True if the tool was removed
   */
  public remove(name: string): boolean {
    return this.unregister(name);
  }

  /**
   * Get a tool by name
   * @param name The tool name
   * @returns The tool instance
   * @throws {ToolNotFoundError} if tool is not found
   */
  public get(name: string): ITool {
    const registered = this.tools.get(name);

    if (!registered) {
      throw new ToolNotFoundError(name);
    }

    if (!registered.enabled) {
      throw new InvalidParametersError(`Tool '${name}' is disabled`);
    }

    return registered.tool;
  }

  /**
   * Check if a tool exists
   * @param name The tool name
   * @returns True if the tool exists
   */
  public has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Enable or disable a tool
   * @param name The tool name
   * @param enabled Whether to enable or disable
   * @returns True if the tool state was changed
   */
  public setEnabled(name: string, enabled: boolean): boolean {
    const registered = this.tools.get(name);

    if (!registered) {
      return false;
    }

    registered.enabled = enabled;
    logger.info('Tool state changed', { name, enabled });

    return true;
  }

  /**
   * Check if a tool is enabled
   * @param name The tool name
   * @returns True if the tool exists and is enabled
   */
  public isEnabled(name: string): boolean {
    const registered = this.tools.get(name);
    return registered ? registered.enabled : false;
  }

  /**
   * Enable a tool
   * @param name The tool name
   * @returns True if the tool was enabled
   */
  public enable(name: string): boolean {
    return this.setEnabled(name, true);
  }

  /**
   * Disable a tool
   * @param name The tool name
   * @returns True if the tool was disabled
   */
  public disable(name: string): boolean {
    return this.setEnabled(name, false);
  }

  /**
   * Get all registered tools
   * @param options Filter options
   * @returns Array of tool information
   */
  public list(options?: {
    enabled?: boolean;
    category?: string;
    includeMetadata?: boolean;
  }): Array<{ name: string; description: string; tool?: ITool; metadata?: RegisteredTool }> {
    const { enabled, category, includeMetadata = false } = options || {};

    let toolNames = Array.from(this.tools.keys());

    // Filter by category
    if (category && this.toolsByCategory.has(category)) {
      const categoryTools = this.toolsByCategory.get(category)!;
      toolNames = toolNames.filter((name) => categoryTools.has(name));
    }

    // Filter by enabled state
    if (enabled !== undefined) {
      toolNames = toolNames.filter((name) => {
        const registered = this.tools.get(name);
        return registered && registered.enabled === enabled;
      });
    }

    // Map to result format
    return toolNames.map((name) => {
      const registered = this.tools.get(name)!;
      const result: any = {
        name: registered.tool.name,
        description: registered.tool.description,
      };

      if (includeMetadata) {
        result.tool = registered.tool;
        result.metadata = registered;
      }

      return result;
    });
  }

  /**
   * Get tools as MCP tool format
   * @param includeDisabled Whether to include disabled tools
   * @returns Array of tools in MCP format
   */
  public getMCPTools(includeDisabled: boolean = false): MCPTool[] {
    return this.list({ enabled: includeDisabled ? undefined : true }).map(({ name }) => {
      const registered = this.tools.get(name)!;
      return {
        name: registered.tool.name,
        description: registered.tool.description,
        inputSchema: registered.tool.inputSchema,
      };
    });
  }

  /**
   * Get all categories
   * @returns Array of category names
   */
  public getCategories(): string[] {
    return Array.from(this.toolsByCategory.keys());
  }

  /**
   * Get tools by category
   * @param category The category name
   * @returns Array of tool names in the category
   */
  public getByCategory(category: string): string[] {
    const toolNames = this.toolsByCategory.get(category);
    return toolNames ? Array.from(toolNames) : [];
  }

  /**
   * Clear all registered tools
   */
  public clear(): void {
    this.tools.clear();
    this.toolsByCategory.clear();
    logger.info('Tool registry cleared');
  }

  /**
   * Get registry statistics
   * @returns Registry statistics
   */
  public getStats(): {
    totalTools: number;
    enabledTools: number;
    disabledTools: number;
    categories: number;
    toolsByCategory: Record<string, number>;
  } {
    let enabledCount = 0;
    let disabledCount = 0;

    for (const registered of this.tools.values()) {
      if (registered.enabled) {
        enabledCount++;
      } else {
        disabledCount++;
      }
    }

    const toolsByCategory: Record<string, number> = {};
    for (const [category, tools] of this.toolsByCategory) {
      toolsByCategory[category] = tools.size;
    }

    return {
      totalTools: this.tools.size,
      enabledTools: enabledCount,
      disabledTools: disabledCount,
      categories: this.toolsByCategory.size,
      toolsByCategory,
    };
  }

  /**
   * Export registry configuration
   * @returns Registry configuration for persistence
   */
  public export(): {
    tools: Array<{
      name: string;
      version: string;
      enabled: boolean;
      registeredAt: string;
      category?: string;
    }>;
    options: ToolRegistryOptions;
  } {
    const tools: any[] = [];

    for (const [name, registered] of this.tools) {
      const toolExport: any = {
        name,
        version: registered.version,
        enabled: registered.enabled,
        registeredAt: registered.registeredAt.toISOString(),
      };

      // Find category
      for (const [category, toolNames] of this.toolsByCategory) {
        if (toolNames.has(name)) {
          toolExport.category = category;
          break;
        }
      }

      tools.push(toolExport);
    }

    return {
      tools,
      options: this.options,
    };
  }

  /**
   * Validate all registered tools
   * @returns Validation results
   */
  public validate(): Array<{ name: string; valid: boolean; error?: string }> {
    const results: Array<{ name: string; valid: boolean; error?: string }> = [];

    for (const [name, registered] of this.tools) {
      try {
        if (!isTool(registered.tool)) {
          results.push({ name, valid: false, error: 'Invalid tool implementation' });
        } else {
          results.push({ name, valid: true });
        }
      } catch (error) {
        results.push({
          name,
          valid: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }
}

/**
 * Create a global tool registry instance
 */
export const globalRegistry = new ToolRegistry();

/**
 * Decorator for automatically registering tools
 */
export function RegisterTool(options?: { version?: string; category?: string }) {
  return function (target: any) {
    // Register the tool when the class is defined
    const instance = new target();
    if (isTool(instance)) {
      globalRegistry.register(instance, options);
    }
    return target;
  };
}
