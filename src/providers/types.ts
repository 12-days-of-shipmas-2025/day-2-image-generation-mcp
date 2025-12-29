/**
 * Provider interface for image generation.
 * Implement this interface to add support for new image generation APIs.
 */

export interface ImageGenerationOptions {
  /** The prompt describing the image to generate */
  prompt: string;
  /** Aspect ratio (e.g., "16:9", "1:1") */
  aspectRatio: string;
  /** Target width in pixels (for reference, actual may vary by provider) */
  width: number;
  /** Target height in pixels (for reference, actual may vary by provider) */
  height: number;
  /** Quality tier: "standard" for speed, "high" for quality */
  quality: "standard" | "high";
  /** Optional style hints */
  style?: string;
}

export interface GeneratedImage {
  /** Base64-encoded image data */
  base64Data: string;
  /** MIME type (e.g., "image/png") */
  mimeType: string;
  /** Actual width of generated image */
  width?: number;
  /** Actual height of generated image */
  height?: number;
  /** Model used to generate the image */
  model?: string;
  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;
}

export interface ImageProvider {
  /** Provider identifier */
  readonly name: string;

  /** Check if the provider is properly configured */
  isConfigured(): boolean;

  /** Generate an image based on the provided options */
  generateImage(options: ImageGenerationOptions): Promise<GeneratedImage>;

  /** Get supported aspect ratios */
  getSupportedAspectRatios(): string[];

  /** Get maximum supported resolution */
  getMaxResolution(): { width: number; height: number };
}

export interface ProviderConfig {
  /** API key for authentication */
  apiKey?: string;
  /** Base URL override (for proxies or enterprise endpoints) */
  baseUrl?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum retries on failure */
  maxRetries?: number;
}

/** Error thrown by providers */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly code: string,
    public readonly isRetryable: boolean = false
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
