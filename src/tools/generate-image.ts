/**
 * Generate blog image tool definition and handler.
 */

import { z } from "zod";

import { PLATFORM_PRESETS, PRESET_KEYS, type PlatformPreset } from "../config/presets.js";
import { createProvider, type GeneratedImage, type ProviderName } from "../providers/index.js";
import {
  estimateFileSize,
  formatFileSize,
  generateDefaultOutputPath,
  saveImage,
  type ImageMetadata,
} from "../utils/image.js";
import { safeErrorMessage, validateOutputPath, validatePrompt } from "../utils/security.js";

/**
 * Zod schema for tool input validation.
 */
export const GenerateImageInputSchema = z.object({
  prompt: z
    .string()
    .min(3, "Prompt must be at least 3 characters")
    .max(4000, "Prompt must be less than 4000 characters")
    .describe("Description of the image to generate"),

  format: z
    .enum(PRESET_KEYS as [string, ...string[]])
    .default("ghost-banner")
    .describe("Platform preset (e.g., 'ghost-banner', 'instagram-post', 'twitter-post')"),

  quality: z
    .enum(["standard", "high"])
    .default("standard")
    .describe("Quality level: 'standard' (faster) or 'high' (better quality, uses Pro model)"),

  style: z
    .string()
    .max(200)
    .optional()
    .describe("Optional style hint (e.g., 'photorealistic', 'illustration', 'minimalist')"),

  title: z.string().max(200).optional().describe("Optional blog post title for context"),

  outputPath: z.string().max(500).optional().describe("Optional path to save the image file"),

  provider: z.enum(["gemini"]).default("gemini").describe("Image generation provider to use"),
});

export type GenerateImageInput = z.infer<typeof GenerateImageInputSchema>;

export interface GenerateImageResult {
  success: boolean;
  message: string;
  image?: {
    base64Data: string;
    mimeType: string;
    format: string;
    dimensions: {
      /** Actual width of generated image */
      width: number;
      /** Actual height of generated image */
      height: number;
      /** Requested width (may differ from actual) */
      requestedWidth?: number;
      /** Requested height (may differ from actual) */
      requestedHeight?: number;
    };
    fileSize: string;
    savedTo?: string;
  };
  preset?: PlatformPreset;
  /** Warning about aspect ratio conversion or other issues */
  warning?: string;
  error?: string;
}

/**
 * Execute the generate_blog_image tool.
 */
export async function executeGenerateImage(
  input: GenerateImageInput
): Promise<GenerateImageResult> {
  // Validate prompt
  const promptValidation = validatePrompt(input.prompt);
  if (!promptValidation.valid) {
    return {
      success: false,
      message: "Invalid prompt",
      error: promptValidation.error,
    };
  }

  // Validate output path if provided
  if (input.outputPath) {
    const pathValidation = validateOutputPath(input.outputPath);
    if (!pathValidation.valid) {
      return {
        success: false,
        message: "Invalid output path",
        error: pathValidation.error,
      };
    }
  }

  // Get preset configuration
  const preset = PLATFORM_PRESETS[input.format];
  if (!preset) {
    return {
      success: false,
      message: "Invalid format",
      error: `Unknown format: ${input.format}. Available: ${PRESET_KEYS.join(", ")}`,
    };
  }

  // Create provider
  const provider = createProvider(input.provider as ProviderName);

  if (!provider.isConfigured()) {
    return {
      success: false,
      message: "Provider not configured",
      error: `${input.provider} provider requires API key. Set GOOGLE_API_KEY environment variable.`,
    };
  }

  // Build enhanced prompt with title context
  let enhancedPrompt = promptValidation.sanitized!;
  if (input.title) {
    enhancedPrompt = `For a blog post titled "${input.title}": ${enhancedPrompt}`;
  }

  // Generate image
  let generatedImage: GeneratedImage;
  try {
    generatedImage = await provider.generateImage({
      prompt: enhancedPrompt,
      aspectRatio: preset.aspectRatio,
      width: preset.width,
      height: preset.height,
      quality: input.quality,
      style: input.style,
    });
  } catch (error) {
    return {
      success: false,
      message: "Image generation failed",
      error: safeErrorMessage(error),
    };
  }

  // Calculate file size
  const fileSize = formatFileSize(estimateFileSize(generatedImage.base64Data));

  // Determine output path - use provided path or generate a default
  const outputPath = input.outputPath ?? generateDefaultOutputPath(generatedImage.mimeType);

  // Build metadata to embed in the image
  const metadata: ImageMetadata = {
    prompt: input.prompt,
    model: generatedImage.model ?? "gemini-2.0-flash-exp",
    provider: input.provider,
    format: input.format,
    style: input.style,
    title: input.title,
    generatedAt: new Date().toISOString(),
  };

  // Always save the image to ensure it's never lost
  let savedPath: string;
  try {
    savedPath = await saveImage(
      generatedImage.base64Data,
      outputPath,
      generatedImage.mimeType,
      metadata
    );
  } catch (error) {
    return {
      success: false,
      message: "Failed to save image",
      error: safeErrorMessage(error),
    };
  }

  // Determine actual dimensions (from provider or estimate from preset)
  const actualWidth = generatedImage.width ?? preset.width;
  const actualHeight = generatedImage.height ?? preset.height;

  // Build warning message if aspect ratio is not natively supported
  let warning: string | undefined;
  if (!preset.nativeAspectRatio) {
    warning =
      `Note: This preset's aspect ratio (${preset.aspectRatio}) is not natively supported by Gemini. ` +
      `Image was generated at ${preset.geminiAspectRatio} aspect ratio. ` +
      `You may need to crop the image to fit ${preset.width}x${preset.height}.`;
  } else if (actualWidth !== preset.width || actualHeight !== preset.height) {
    warning =
      `Image was generated at ${actualWidth}x${actualHeight}, which differs from the preset's ${preset.width}x${preset.height}. ` +
      `You may need to resize the image.`;
  }

  // Build descriptive message - image is always saved
  const message = `Image generated and saved to ${savedPath}`;

  return {
    success: true,
    message,
    image: {
      base64Data: generatedImage.base64Data,
      mimeType: generatedImage.mimeType,
      format: input.format,
      dimensions: {
        width: actualWidth,
        height: actualHeight,
        requestedWidth: preset.width,
        requestedHeight: preset.height,
      },
      fileSize,
      savedTo: savedPath,
    },
    preset,
    warning,
  };
}

/**
 * Get tool description for MCP registration.
 */
export function getToolDescription(): string {
  const presetList = Object.entries(PLATFORM_PRESETS)
    .map(([key, preset]) => `  - ${key}: ${preset.name} (${preset.width}x${preset.height})`)
    .join("\n");

  return `Generate images for blog posts and social media using AI.

Available formats:
${presetList}

Examples:
- Generate a Ghost blog banner: { "prompt": "A serene mountain landscape at sunset", "format": "ghost-banner" }
- High quality Instagram post: { "prompt": "Minimalist coffee cup on marble", "format": "instagram-post", "quality": "high" }
- YouTube thumbnail with title: { "prompt": "Exciting tech reveal", "format": "youtube-thumbnail", "title": "New iPhone 17 Review" }

IMPORTANT: Always specify an outputPath to save the image to a meaningful location. If omitted, images are saved to a generated-images/ directory in the current working directory with a timestamped filename.`;
}
