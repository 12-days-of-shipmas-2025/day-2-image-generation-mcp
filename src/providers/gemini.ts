/**
 * Gemini/Nano Banana image generation provider.
 * Supports both gemini-2.5-flash-image and gemini-3-pro-image-preview models.
 */

import { GoogleGenAI } from "@google/genai";

import { toGeminiAspectRatio } from "../config/presets.js";

import {
  GeneratedImage,
  ImageGenerationOptions,
  ImageProvider,
  ProviderConfig,
  ProviderError,
} from "./types.js";

type GeminiModel = "gemini-2.5-flash-image" | "gemini-3-pro-image-preview";
type GeminiAspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

interface GeminiProviderConfig extends ProviderConfig {
  /** Default model to use */
  defaultModel?: GeminiModel;
}

export class GeminiProvider implements ImageProvider {
  readonly name = "gemini";

  private client: GoogleGenAI | null = null;
  private config: GeminiProviderConfig;

  // Gemini-supported aspect ratios
  private static readonly SUPPORTED_ASPECT_RATIOS: GeminiAspectRatio[] = [
    "1:1",
    "16:9",
    "9:16",
    "4:3",
    "3:4",
  ];

  constructor(config: GeminiProviderConfig = {}) {
    this.config = {
      timeout: 60000,
      maxRetries: 2,
      defaultModel: "gemini-2.5-flash-image",
      ...config,
    };

    // Initialize client if API key is available
    const apiKey = config.apiKey || process.env.GOOGLE_API_KEY;
    if (apiKey) {
      this.client = new GoogleGenAI({ apiKey });
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  getSupportedAspectRatios(): string[] {
    return [...GeminiProvider.SUPPORTED_ASPECT_RATIOS];
  }

  getMaxResolution(): { width: number; height: number } {
    // Gemini 3 Pro supports up to 4K
    return { width: 4096, height: 4096 };
  }

  async generateImage(options: ImageGenerationOptions): Promise<GeneratedImage> {
    if (!this.client) {
      throw new ProviderError(
        "Gemini provider not configured. Set GOOGLE_API_KEY environment variable.",
        this.name,
        "NOT_CONFIGURED"
      );
    }

    // Select model based on quality requirement
    const model: GeminiModel =
      options.quality === "high"
        ? "gemini-3-pro-image-preview"
        : (this.config.defaultModel ?? "gemini-2.5-flash-image");

    // Map aspect ratio to Gemini-compatible format
    const aspectRatio = toGeminiAspectRatio(options.aspectRatio);

    // Build the prompt with optional style
    let fullPrompt = options.prompt;
    if (options.style) {
      fullPrompt = `${options.style} style: ${options.prompt}`;
    }

    try {
      const response = await this.client.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
        config: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: {
            aspectRatio,
            // For Pro model, we can request higher resolution
            ...(model === "gemini-3-pro-image-preview" && options.width > 1500
              ? { imageSize: options.width > 3000 ? "4K" : "2K" }
              : {}),
          },
        },
      });

      // Extract image from response
      const candidate = response.candidates?.[0];
      if (!candidate?.content?.parts) {
        throw new ProviderError("No image generated in response", this.name, "NO_IMAGE", true);
      }

      // Find the image part in the response
      for (const part of candidate.content.parts) {
        if (part.inlineData?.mimeType?.startsWith("image/")) {
          const imageData = part.inlineData.data;

          // Validate that we actually have image data
          if (!imageData || imageData.length === 0) {
            throw new ProviderError(
              "Empty image data in response",
              this.name,
              "EMPTY_IMAGE_DATA",
              true
            );
          }

          // Calculate actual dimensions based on Gemini's aspect ratio behavior
          // Gemini returns images at these standard sizes for each aspect ratio
          const actualDimensions = this.getActualDimensions(
            aspectRatio,
            options.width,
            options.height
          );

          return {
            base64Data: imageData,
            mimeType: part.inlineData.mimeType,
            width: actualDimensions.width,
            height: actualDimensions.height,
            model,
            metadata: {
              aspectRatio,
              requestedWidth: options.width,
              requestedHeight: options.height,
              promptTokens: response.usageMetadata?.promptTokenCount,
              candidatesTokens: response.usageMetadata?.candidatesTokenCount,
            },
          };
        }
      }

      throw new ProviderError("No image data found in response", this.name, "NO_IMAGE_DATA", true);
    } catch (error) {
      // Re-throw ProviderErrors as-is
      if (error instanceof ProviderError) {
        throw error;
      }

      // Wrap other errors
      const message = error instanceof Error ? error.message : "Unknown error";
      const isRetryable =
        message.includes("rate limit") || message.includes("timeout") || message.includes("503");

      throw new ProviderError(`Gemini API error: ${message}`, this.name, "API_ERROR", isRetryable);
    }
  }

  /**
   * Get actual dimensions that Gemini will produce for a given aspect ratio.
   * Gemini generates images at standard sizes based on the aspect ratio.
   */
  private getActualDimensions(
    aspectRatio: GeminiAspectRatio,
    requestedWidth: number,
    _requestedHeight: number
  ): { width: number; height: number } {
    // Gemini's standard output sizes (approximate - may vary by model)
    // These are based on observed outputs and API documentation
    const standardSizes: Record<GeminiAspectRatio, { width: number; height: number }> = {
      "1:1": { width: 1024, height: 1024 },
      "16:9": { width: 1536, height: 864 },
      "9:16": { width: 864, height: 1536 },
      "4:3": { width: 1280, height: 960 },
      "3:4": { width: 960, height: 1280 },
    };

    // For high-resolution requests on Pro model, dimensions may be larger
    if (requestedWidth > 1500) {
      // Scale up proportionally for larger requests
      const base = standardSizes[aspectRatio];
      const scale = requestedWidth > 3000 ? 2.5 : 1.5;
      return {
        width: Math.round(base.width * scale),
        height: Math.round(base.height * scale),
      };
    }

    return standardSizes[aspectRatio];
  }
}
