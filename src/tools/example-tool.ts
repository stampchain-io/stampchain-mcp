/**
 * Example tool implementation demonstrating how to use the ITool interface
 * This tool shows best practices for parameter validation, error handling, and response formatting
 */

import { z } from 'zod';
import type { Tool as MCPTool } from '@modelcontextprotocol/sdk/types.js';
import type { ITool, ToolResponse, ToolContext, ToolMetadata } from '../interfaces/tool.js';
import { textResponse, multiResponse, BaseTool } from '../interfaces/tool.js';
import { MCPError, ValidationError, ToolExecutionError } from '../utils/errors.js';

/**
 * Parameters schema for the example tool using Zod
 */
const ExampleToolParamsSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty'),
  uppercase: z.boolean().optional().default(false),
  repeat: z.number().int().min(1).max(10).optional().default(1),
  format: z.enum(['plain', 'json', 'markdown']).optional().default('plain'),
});

/**
 * Input type (what the tool receives)
 */
type ExampleToolInput = z.input<typeof ExampleToolParamsSchema>;

/**
 * Output type (what Zod produces after parsing, with defaults applied)
 */
type ExampleToolParams = z.output<typeof ExampleToolParamsSchema>;

/**
 * Example tool implementation showing all features
 * This tool takes a message and formats it based on the parameters
 */
export class ExampleTool implements ITool<ExampleToolInput, ExampleToolParams> {
  public readonly name = 'example_tool';

  public readonly description =
    'An example tool that demonstrates parameter validation and response formatting';

  public readonly inputSchema: MCPTool['inputSchema'] = {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'The message to process',
      },
      uppercase: {
        type: 'boolean',
        description: 'Whether to convert the message to uppercase',
        default: false,
      },
      repeat: {
        type: 'number',
        description: 'Number of times to repeat the message (1-10)',
        minimum: 1,
        maximum: 10,
        default: 1,
      },
      format: {
        type: 'string',
        enum: ['plain', 'json', 'markdown'],
        description: 'Output format for the message',
        default: 'plain',
      },
    },
    required: ['message'],
  };

  public readonly schema = ExampleToolParamsSchema;

  public readonly metadata: ToolMetadata = {
    version: '1.0.0',
    author: 'Stampchain Team',
    tags: ['example', 'demo'],
    requiresNetwork: false,
  };

  /**
   * Executes the example tool
   * @param params - Validated parameters
   * @param context - Execution context
   * @returns Formatted response
   */
  public execute(params: ExampleToolParams, context?: ToolContext): Promise<ToolResponse> {
    try {
      // Log the execution
      context?.logger?.info('Executing example tool', { params });

      // Validate parameters using Zod
      const validatedParams = this.schema.parse(params);

      // Process the message
      let processedMessage = validatedParams.message;

      if (validatedParams.uppercase) {
        processedMessage = processedMessage.toUpperCase();
      }

      // Repeat the message if requested
      const messages: string[] = [];
      for (let i = 0; i < validatedParams.repeat; i++) {
        messages.push(processedMessage);
      }

      // Format the output based on the format parameter
      switch (validatedParams.format) {
        case 'json': {
          return Promise.resolve(
            textResponse(
              JSON.stringify(
                {
                  original: validatedParams.message,
                  processed: messages,
                  parameters: validatedParams,
                },
                null,
                2
              )
            )
          );
        }

        case 'markdown': {
          const markdown = [
            '# Example Tool Output',
            '',
            `**Original Message:** ${validatedParams.message}`,
            '',
            '**Processed Output:**',
            ...messages.map((msg, i) => `${i + 1}. ${msg}`),
            '',
            '---',
            `*Generated with uppercase: ${validatedParams.uppercase}, repeat: ${validatedParams.repeat}*`,
          ].join('\n');
          return Promise.resolve(textResponse(markdown));
        }

        case 'plain':
        default:
          return Promise.resolve(textResponse(messages.join('\n')));
      }
    } catch (error) {
      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        const issues = error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
        throw new ValidationError('Invalid parameters provided', { issues });
      }

      // Re-throw MCP errors
      if (error instanceof MCPError) {
        throw error;
      }

      // Wrap unknown errors
      throw new ToolExecutionError('Failed to execute example tool', this.name, error);
    }
  }
}

/**
 * Alternative implementation using the BaseTool abstract class
 * This shows how to extend BaseTool for simpler implementations
 */
export class SimplifiedExampleTool extends BaseTool<ExampleToolInput, ExampleToolParams> {
  public readonly name = 'simplified_example';

  public readonly description = 'A simplified example using BaseTool';

  public readonly inputSchema: MCPTool['inputSchema'] = {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'The message to echo back',
      },
      uppercase: {
        type: 'boolean',
        description: 'Convert to uppercase',
        default: false,
      },
      repeat: {
        type: 'number',
        description: 'Times to repeat (1-10)',
        minimum: 1,
        maximum: 10,
        default: 1,
      },
      format: {
        type: 'string',
        enum: ['plain', 'json', 'markdown'],
        description: 'Output format',
        default: 'plain',
      },
    },
    required: ['message'],
  };

  public readonly schema = ExampleToolParamsSchema;

  public readonly metadata: ToolMetadata = {
    version: '1.0.0',
    tags: ['example', 'simplified'],
  };

  /**
   * Simplified execute implementation
   */
  public execute(params: ExampleToolParams, context?: ToolContext): Promise<ToolResponse> {
    // BaseTool provides validateParams method
    const validatedParams = this.validateParams(params);

    context?.logger?.debug('Executing simplified example', { params: validatedParams });

    const message = validatedParams.uppercase
      ? validatedParams.message.toUpperCase()
      : validatedParams.message;

    const repeated = Array(validatedParams.repeat).fill(message);

    if (validatedParams.format === 'json') {
      return Promise.resolve(textResponse(JSON.stringify({ messages: repeated }, null, 2)));
    }

    return Promise.resolve(textResponse(repeated.join('\n')));
  }
}

/**
 * Schema for multi-content example tool
 */
const MultiContentSchema = z.object({
  text: z.string().min(1),
  includeStats: z.boolean().default(true),
});

type MultiContentInput = z.input<typeof MultiContentSchema>;
type MultiContentParams = z.output<typeof MultiContentSchema>;

/**
 * Example of a tool that returns multiple content types
 */
export class MultiContentExampleTool implements ITool<MultiContentInput, MultiContentParams> {
  public readonly name = 'multi_content_example';

  public readonly description = 'Demonstrates returning multiple content items';

  public readonly inputSchema: MCPTool['inputSchema'] = {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'Text to analyze',
      },
      includeStats: {
        type: 'boolean',
        description: 'Include statistics',
        default: true,
      },
    },
    required: ['text'],
  };

  public readonly schema = MultiContentSchema;

  public execute(params: MultiContentParams, _context?: ToolContext): Promise<ToolResponse> {
    const validated = this.schema.parse(params);

    const contents = [{ type: 'text' as const, text: `Processed: ${validated.text}` }];

    if (validated.includeStats) {
      contents.push({
        type: 'text' as const,
        text: `Stats: ${validated.text.length} characters, ${validated.text.split(' ').length} words`,
      });
    }

    return Promise.resolve(multiResponse(...contents));
  }
}

/**
 * Factory function to create an instance of the example tool
 */
export function createExampleTool(): ExampleTool {
  return new ExampleTool();
}

/**
 * Export all example tools
 */
export const exampleTools = {
  example: new ExampleTool(),
  simplified: new SimplifiedExampleTool(),
  multiContent: new MultiContentExampleTool(),
};
