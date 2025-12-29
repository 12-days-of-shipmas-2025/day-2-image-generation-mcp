#!/usr/bin/env node

/**
 * Blog Image MCP Server
 *
 * An MCP server for generating blog and social media images using AI.
 * Supports multiple providers (Gemini/Nano Banana) and platform presets.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { PLATFORM_PRESETS, PRESET_KEYS } from "./config/presets.js";
import { getConfiguredProviders } from "./providers/index.js";
import {
  GenerateImageInputSchema,
  executeGenerateImage,
  getToolDescription,
} from "./tools/generate-image.js";
import { safeErrorMessage } from "./utils/security.js";

// Server metadata
const SERVER_NAME = "blog-image-mcp";
const SERVER_VERSION = "1.1.1";

/**
 * Create and configure the MCP server.
 */
function createServer(): Server {
  const server = new Server(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register tool listing handler
  server.setRequestHandler(ListToolsRequestSchema, () => {
    return {
      tools: [
        {
          name: "generate_blog_image",
          description: getToolDescription(),
          inputSchema: {
            type: "object" as const,
            properties: {
              prompt: {
                type: "string",
                description: "Description of the image to generate",
                minLength: 3,
                maxLength: 4000,
              },
              format: {
                type: "string",
                description: `Platform preset: ${PRESET_KEYS.join(", ")}`,
                enum: PRESET_KEYS,
                default: "ghost-banner",
              },
              quality: {
                type: "string",
                description: "Quality level",
                enum: ["standard", "high"],
                default: "standard",
              },
              style: {
                type: "string",
                description: "Optional style hint (e.g., 'photorealistic', 'illustration')",
                maxLength: 200,
              },
              title: {
                type: "string",
                description: "Optional blog post title for context",
                maxLength: 200,
              },
              outputPath: {
                type: "string",
                description: "Optional path to save the image file",
                maxLength: 500,
              },
              provider: {
                type: "string",
                description: "Image generation provider",
                enum: ["gemini"],
                default: "gemini",
              },
            },
            required: ["prompt"],
          },
        },
        {
          name: "list_image_formats",
          description:
            "List all available image format presets with their dimensions and use cases.",
          inputSchema: {
            type: "object" as const,
            properties: {
              category: {
                type: "string",
                description: "Filter by category",
                enum: ["blog", "social", "video", "generic"],
              },
            },
          },
        },
      ],
    };
  });

  // Register tool execution handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "generate_blog_image": {
          // Parse and validate input
          const parseResult = GenerateImageInputSchema.safeParse(args);
          if (!parseResult.success) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Invalid input: ${parseResult.error.errors.map((e) => e.message).join(", ")}`,
                },
              ],
              isError: true,
            };
          }

          // Execute generation
          const result = await executeGenerateImage(parseResult.data);

          if (!result.success) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Error: ${result.error ?? result.message}`,
                },
              ],
              isError: true,
            };
          }

          // Return success with image
          const content: Array<{
            type: "text" | "image";
            text?: string;
            data?: string;
            mimeType?: string;
          }> = [
            {
              type: "text" as const,
              text: result.message,
            },
          ];

          // Include image data if available
          if (result.image) {
            content.push({
              type: "image" as const,
              data: result.image.base64Data,
              mimeType: result.image.mimeType,
            });

            content.push({
              type: "text" as const,
              text: `\nDetails:\n- Format: ${result.image.format}\n- Dimensions: ${result.image.dimensions.width}x${result.image.dimensions.height}\n- File size: ${result.image.fileSize}${result.image.savedTo ? `\n- Saved to: ${result.image.savedTo}` : ""}`,
            });
          }

          return { content };
        }

        case "list_image_formats": {
          const category = (args as Record<string, unknown>)?.category as string | undefined;

          let presets = Object.entries(PLATFORM_PRESETS);
          if (category) {
            presets = presets.filter(([, preset]) => preset.category === category);
          }

          const formatList = presets
            .map(
              ([key, preset]) =>
                `**${key}** (${preset.category})\n  ${preset.name}\n  ${preset.width}x${preset.height} (${preset.aspectRatio})\n  ${preset.description}`
            )
            .join("\n\n");

          return {
            content: [
              {
                type: "text" as const,
                text: `Available Image Formats:\n\n${formatList}`,
              },
            ],
          };
        }

        default:
          return {
            content: [
              {
                type: "text" as const,
                text: `Unknown tool: ${name}`,
              },
            ],
            isError: true,
          };
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${safeErrorMessage(error)}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  // Check for help flag
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    // eslint-disable-next-line no-console
    console.log(`
${SERVER_NAME} v${SERVER_VERSION}

An MCP server for generating blog and social media images using AI.

Environment Variables:
  GOOGLE_API_KEY    Required for Gemini/Nano Banana provider

Usage with Claude Desktop:
  Add to claude_desktop_config.json:
  {
    "mcpServers": {
      "blog-image": {
        "command": "npx",
        "args": ["blog-image-mcp"],
        "env": {
          "GOOGLE_API_KEY": "your-api-key"
        }
      }
    }
  }

Tools:
  generate_blog_image  Generate an image for blog/social media
  list_image_formats   List available format presets
`);
    process.exit(0);
  }

  // Check for version flag
  if (process.argv.includes("--version") || process.argv.includes("-v")) {
    // eslint-disable-next-line no-console
    console.log(SERVER_VERSION);
    process.exit(0);
  }

  // Create and start server
  const server = createServer();
  const transport = new StdioServerTransport();

  // Handle errors
  server.onerror = (error) => {
    console.error("[MCP Error]", safeErrorMessage(error));
  };

  // Connect transport
  await server.connect(transport);

  // Log startup (to stderr to not interfere with stdio protocol)
  console.error(`[${SERVER_NAME}] Server started (v${SERVER_VERSION})`);

  const configured = getConfiguredProviders();
  if (configured.length === 0) {
    console.error(`[${SERVER_NAME}] Warning: No providers configured. Set GOOGLE_API_KEY.`);
  } else {
    console.error(`[${SERVER_NAME}] Configured providers: ${configured.join(", ")}`);
  }
}

// Run
main().catch((error) => {
  console.error("Fatal error:", safeErrorMessage(error));
  process.exit(1);
});
