# image-generation-mcp

[![npm version](https://img.shields.io/npm/v/image-generation-mcp.svg)](https://www.npmjs.com/package/image-generation-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An MCP (Model Context Protocol) server for generating blog and social media images using AI. Currently supports Google's Gemini/Nano Banana image generation models with a provider architecture designed for easy extension.

**Install:** `npx -y image-generation-mcp`

## Features

- **Platform Presets**: Pre-configured dimensions for Ghost, Medium, Instagram, Twitter, LinkedIn, YouTube, and more
- **Multiple Quality Levels**: Standard (fast) or High (uses Gemini Pro for better quality)
- **Provider Architecture**: Extensible design to support multiple AI providers
- **Security First**: Input validation, prompt sanitization, safe error handling
- **Flexible Output**: Return base64 image data or save directly to disk

## Quick Start

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_API_KEY` | Yes | Your Google AI API key for Gemini |

Get your API key from [Google AI Studio](https://aistudio.google.com/apikey).

---

## Claude Code Setup

### Option 1: Published Package (Recommended)

```bash
# Add to Claude Code (user scope - available in all projects)
claude mcp add image-gen --scope user -e GOOGLE_API_KEY=your-api-key -- npx -y image-generation-mcp

# Or add to current project only
claude mcp add image-gen -e GOOGLE_API_KEY=your-api-key -- npx -y image-generation-mcp
```

### Option 2: Local Development

```bash
# From the project directory, build first
npm run build

# Add local server to Claude Code
claude mcp add image-gen -e GOOGLE_API_KEY=your-api-key -- node /absolute/path/to/image-generation-mcp/dist/index.js
```

### Option 3: Manual Configuration

Add to `~/.claude.json` (user scope) or `.mcp.json` (project scope):

```json
{
  "mcpServers": {
    "image-gen": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "image-generation-mcp"],
      "env": {
        "GOOGLE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

For local development:

```json
{
  "mcpServers": {
    "image-gen": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/image-generation-mcp/dist/index.js"],
      "env": {
        "GOOGLE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Verify Installation

```bash
# List configured MCP servers
claude mcp list

# Check status within Claude Code
/mcp
```

---

## Claude Desktop Setup

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "image-gen": {
      "command": "npx",
      "args": ["-y", "image-generation-mcp"],
      "env": {
        "GOOGLE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

**Config file locations:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

---

## Tools

### generate_blog_image

Generate an image for blog posts or social media.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | Description of the image to generate |
| `format` | string | No | Platform preset (default: `ghost-banner`) |
| `quality` | string | No | `standard` or `high` (default: `standard`) |
| `style` | string | No | Style hint (e.g., "photorealistic", "illustration") |
| `title` | string | No | Blog post title for context |
| `outputPath` | string | No | Path to save the image file |
| `provider` | string | No | Provider to use (default: `gemini`) |

**Example:**

```
Generate a blog banner for my post about TypeScript best practices.
Use format: medium-ghost-spooky, style: modern minimalist
```

### list_image_formats

List all available image format presets.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `category` | string | No | Filter by category: `blog`, `social`, `video`, `generic` |

## Available Formats

### Blog Platforms
| Format | Dimensions | Ratio | Description |
|--------|------------|-------|-------------|
| `ghost-banner` | 1200x675 | 16:9 | Featured image for Ghost blog posts |
| `ghost-feature` | 2000x1125 | 16:9 | High-resolution feature image for Ghost |
| `medium-ghost-spooky` | 2560x1440 | 16:9 | Premium high-resolution blog banner (QHD) |
| `medium-banner` | 1400x788 | 16:9 | Banner image for Medium articles |
| `substack-header` | 1456x816 | 16:9 | Header image for Substack posts |
| `wordpress-featured` | 1200x675 | 16:9 | Featured image for WordPress posts |

### Social Media
| Format | Dimensions | Ratio | Description |
|--------|------------|-------|-------------|
| `instagram-post` | 1080x1080 | 1:1 | Square post for Instagram feed |
| `instagram-story` | 1080x1920 | 9:16 | Vertical story/reel for Instagram |
| `twitter-post` | 1200x675 | 16:9 | Image for Twitter/X posts |
| `linkedin-post` | 1200x628 | ~1.91:1 | Image for LinkedIn posts |
| `facebook-post` | 1200x630 | ~1.91:1 | Image for Facebook posts |

### Video Platforms
| Format | Dimensions | Ratio | Description |
|--------|------------|-------|-------------|
| `youtube-thumbnail` | 1280x720 | 16:9 | Thumbnail for YouTube videos |
| `youtube-banner` | 2560x1440 | 16:9 | Channel banner for YouTube |

### Generic
| Format | Dimensions | Ratio | Description |
|--------|------------|-------|-------------|
| `square` | 1024x1024 | 1:1 | Generic square image |
| `landscape` | 1920x1080 | 16:9 | Standard landscape (1080p) |
| `landscape-4k` | 3840x2160 | 16:9 | 4K landscape image |
| `portrait` | 1080x1920 | 9:16 | Standard portrait/vertical image |

## Security

This MCP server implements several security measures:

- **Input Validation**: Prompts are validated for length and sanitized
- **Prompt Injection Protection**: Suspicious patterns are blocked
- **Path Traversal Prevention**: Output paths are validated
- **Safe Error Messages**: API keys and sensitive data are never exposed in errors
- **No Logging of Secrets**: API keys are never logged

## ⚠️ Disclaimer

**This is a simple, vibe-coded MCP server for generating images.** It is provided as-is for convenience and educational purposes.

### What You Should Know

1. **API Key Security**: Your `GOOGLE_API_KEY` is as safe as you make it. We do not store, log, or transmit your API key anywhere except to Google's API. You are responsible for:
   - Keeping your API key secure
   - Not committing it to version control
   - Rotating it if you suspect it has been compromised

2. **Data Transmission**: Your prompts and generated images are sent to/from Google's Gemini API. Review [Google's AI Terms of Service](https://ai.google.dev/gemini-api/terms) for their data handling policies.

3. **No Warranty**: This software is provided "AS IS", without warranty of any kind. The authors are not liable for any damages, data loss, API costs, or other issues arising from use of this software.

4. **API Costs**: Image generation may incur costs on your Google Cloud account. Monitor your usage and set up billing alerts.

5. **Content Responsibility**: You are responsible for the prompts you submit and the images you generate. Do not use this tool to generate harmful, illegal, or policy-violating content.

### License

MIT License - see [LICENSE](./LICENSE) for full terms.

**By using this software, you acknowledge that you have read and understood these terms.**

## Adding New Providers

The server uses a provider interface pattern. To add a new provider:

1. Create a new file in `src/providers/` implementing `ImageProvider`
2. Register it in `src/providers/index.ts`

```typescript
// src/providers/my-provider.ts
import { ImageProvider, ImageGenerationOptions, GeneratedImage } from "./types.js";

export class MyProvider implements ImageProvider {
  readonly name = "my-provider";

  isConfigured(): boolean { /* ... */ }
  generateImage(options: ImageGenerationOptions): Promise<GeneratedImage> { /* ... */ }
  getSupportedAspectRatios(): string[] { /* ... */ }
  getMaxResolution(): { width: number; height: number } { /* ... */ }
}
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run locally
GOOGLE_API_KEY=your-key node dist/index.js

# Watch mode
npm run dev

# Run tests
npm test

# Lint and format
npm run lint
npm run format
```

## Publishing to npm

```bash
# 1. Make sure you're logged in to npm
npm login

# 2. Update version in package.json (if needed)
npm version patch  # or minor, major

# 3. Run all checks
npm run check

# 4. Publish
npm publish

# 5. After publishing, users can install with:
#    npx image-generation-mcp
#    or: npm install -g image-generation-mcp
```

## License

MIT
