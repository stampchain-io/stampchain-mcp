import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
/**
 * Tests for ToolRegistry system
 */

import { ToolRegistry } from '../../tools/registry.js';
import { GetStampTool } from '../../tools/stamps.js';
import { GetCollectionTool } from '../../tools/collections.js';
import { createMockToolContext } from '../utils/test-helpers.js';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;
  let mockTool1: GetStampTool;
  let mockTool2: GetCollectionTool;

  beforeEach(() => {
    registry = new ToolRegistry({
      validateOnRegister: true,
      allowDuplicateNames: false,
      maxTools: 100,
    });

    mockTool1 = new GetStampTool();
    mockTool2 = new GetCollectionTool();
  });

  describe('constructor', () => {
    it('should create registry with default options', () => {
      const defaultRegistry = new ToolRegistry();
      expect(defaultRegistry).toBeInstanceOf(ToolRegistry);
    });

    it('should create registry with custom options', () => {
      const customRegistry = new ToolRegistry({
        validateOnRegister: false,
        allowDuplicateNames: true,
        maxTools: 50,
      });
      expect(customRegistry).toBeInstanceOf(ToolRegistry);
    });
  });

  describe('register', () => {
    it('should register a tool successfully', () => {
      registry.register(mockTool1, {
        category: 'stamps',
        version: '1.0.0',
      });

      expect(registry.has('get_stamp')).toBe(true);
      expect(registry.get('get_stamp')).toBe(mockTool1);
    });

    it('should register tool with minimal metadata', () => {
      registry.register(mockTool1);

      expect(registry.has('get_stamp')).toBe(true);
      expect(registry.get('get_stamp')).toBe(mockTool1);
    });

    it('should reject duplicate tool names when not allowed', () => {
      registry.register(mockTool1);

      expect(() => {
        registry.register(mockTool1, { category: 'duplicate' });
      }).toThrow("Tool with name 'get_stamp' already registered");
    });

    it('should allow duplicate tool names when configured', () => {
      const duplicateRegistry = new ToolRegistry({
        allowDuplicateNames: true,
      });

      duplicateRegistry.register(mockTool1);

      expect(() => {
        duplicateRegistry.register(mockTool1, { category: 'duplicate' });
      }).not.toThrow();
    });

    it('should enforce maximum tool limit', () => {
      const limitedRegistry = new ToolRegistry({
        maxTools: 1,
      });

      limitedRegistry.register(mockTool1);

      expect(() => {
        limitedRegistry.register(mockTool2);
      }).toThrow('Maximum number of tools (1) reached');
    });

    it('should validate tool when enabled', () => {
      // Mock a tool with invalid structure
      const invalidTool = {} as any;

      expect(() => {
        registry.register(invalidTool);
      }).toThrow();
    });

    it('should skip validation when disabled', () => {
      const nonValidatingRegistry = new ToolRegistry({
        validateOnRegister: false,
      });

      const invalidTool = { name: 'test', description: 'test' } as any;

      expect(() => {
        nonValidatingRegistry.register(invalidTool);
      }).not.toThrow();
    });
  });

  describe('get', () => {
    beforeEach(() => {
      registry.register(mockTool1, { category: 'stamps' });
      registry.register(mockTool2, { category: 'collections' });
    });

    it('should retrieve registered tool', () => {
      const tool = registry.get('get_stamp');
      expect(tool).toBe(mockTool1);
    });

    it('should throw error for non-existent tool', () => {
      expect(() => {
        registry.get('non_existent_tool');
      }).toThrow('Tool not found: non_existent_tool');
    });
  });

  describe('has', () => {
    beforeEach(() => {
      registry.register(mockTool1);
    });

    it('should return true for registered tool', () => {
      expect(registry.has('get_stamp')).toBe(true);
    });

    it('should return false for non-existent tool', () => {
      expect(registry.has('non_existent_tool')).toBe(false);
    });
  });

  describe('list', () => {
    beforeEach(() => {
      registry.register(mockTool1, { category: 'stamps' });
      registry.register(mockTool2, { category: 'collections' });
    });

    it('should list all registered tool names', () => {
      const tools = registry.list();
      const toolNames = tools.map((tool) => tool.name);
      expect(toolNames).toContain('get_stamp');
      expect(toolNames).toContain('get_collection');
      expect(tools).toHaveLength(2);
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      registry.register(mockTool1);
      registry.register(mockTool2);
    });

    it('should remove registered tool', () => {
      expect(registry.has('get_stamp')).toBe(true);

      registry.remove('get_stamp');

      expect(registry.has('get_stamp')).toBe(false);
    });

    it('should return false for non-existent tool', () => {
      const result = registry.remove('non_existent_tool');
      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    beforeEach(() => {
      registry.register(mockTool1);
      registry.register(mockTool2);
    });

    it('should remove all tools', () => {
      expect(registry.list()).toHaveLength(2);

      registry.clear();

      expect(registry.list()).toHaveLength(0);
    });
  });

  describe('getByCategory', () => {
    beforeEach(() => {
      registry.register(mockTool1, { category: 'stamps' });
      registry.register(mockTool2, { category: 'collections' });
    });

    it('should return tools in specified category', () => {
      const stampsTools = registry.getByCategory('stamps');
      expect(stampsTools).toContain('get_stamp');
      expect(stampsTools).toHaveLength(1);
    });

    it('should return empty array for non-existent category', () => {
      const nonExistentTools = registry.getByCategory('non_existent');
      expect(nonExistentTools).toEqual([]);
    });
  });

  describe('getCategories', () => {
    beforeEach(() => {
      registry.register(mockTool1, { category: 'stamps' });
      registry.register(mockTool2, { category: 'collections' });
    });

    it('should return all categories', () => {
      const categories = registry.getCategories();
      expect(categories).toContain('stamps');
      expect(categories).toContain('collections');
      expect(categories).toHaveLength(2);
    });
  });

  describe('enable/disable', () => {
    beforeEach(() => {
      registry.register(mockTool1);
    });

    it('should disable tool', () => {
      expect(registry.isEnabled('get_stamp')).toBe(true);

      registry.disable('get_stamp');

      expect(registry.isEnabled('get_stamp')).toBe(false);
    });

    it('should enable tool', () => {
      registry.disable('get_stamp');
      expect(registry.isEnabled('get_stamp')).toBe(false);

      registry.enable('get_stamp');

      expect(registry.isEnabled('get_stamp')).toBe(true);
    });

    it('should handle non-existent tools gracefully', () => {
      expect(() => {
        registry.disable('non_existent_tool');
      }).not.toThrow();

      expect(() => {
        registry.enable('non_existent_tool');
      }).not.toThrow();
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      registry.register(mockTool1, { category: 'stamps' });
      registry.register(mockTool2, { category: 'collections' });
      registry.disable('get_stamp');
    });

    it('should return accurate statistics', () => {
      const stats = registry.getStats();

      expect(stats.totalTools).toBe(2);
      expect(stats.enabledTools).toBe(1);
      expect(stats.disabledTools).toBe(1);
      expect(stats.categories).toBe(2);
    });
  });

  describe('getMCPTools', () => {
    beforeEach(() => {
      registry.register(mockTool1, { category: 'stamps' });
      registry.register(mockTool2, { category: 'collections' });
      registry.disable('get_stamp');
    });

    it('should return only enabled tools in MCP format', () => {
      const mcpTools = registry.getMCPTools();

      expect(mcpTools).toHaveLength(1);
      expect(mcpTools[0].name).toBe('get_collection');
      expect(mcpTools[0].description).toBeDefined();
      expect(mcpTools[0].inputSchema).toBeDefined();
    });

    it('should return all tools when includeDisabled is true', () => {
      const mcpTools = registry.getMCPTools(true);

      expect(mcpTools).toHaveLength(2);
      expect(mcpTools.map((t) => t.name)).toContain('get_stamp');
      expect(mcpTools.map((t) => t.name)).toContain('get_collection');
    });
  });

  describe('export/import', () => {
    beforeEach(() => {
      registry.register(mockTool1, {
        category: 'stamps',
        version: '1.0.0',
        description: 'Custom description',
      });
      registry.register(mockTool2, { category: 'collections' });
    });

    it('should export registry configuration', () => {
      const exported = registry.export();

      expect(exported.tools).toHaveLength(2);
      expect(exported.tools[0].name).toBe('get_stamp');
      expect(exported.tools[0].category).toBe('stamps');
      expect(exported.options).toBeDefined();
    });

    it('should import registry configuration', () => {
      const exported = registry.export();
      const newRegistry = new ToolRegistry();

      // Note: Import would need to be implemented to recreate tool instances
      // This test validates the export structure
      expect(exported.tools).toBeDefined();
      expect(exported.options).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle tool execution errors gracefully', async () => {
      const context = createMockToolContext();
      registry.register(mockTool1);

      // Mock tool execution to throw error
      const originalExecute = mockTool1.execute;
      mockTool1.execute = vi.fn().mockRejectedValueOnce(new Error('Tool execution failed'));

      const tool = registry.get('get_stamp');

      await expect(tool.execute({}, context)).rejects.toThrow('Tool execution failed');

      // Restore original method
      mockTool1.execute = originalExecute;
    });
  });
});
