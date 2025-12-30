/**
 * Image utility functions for saving and processing generated images.
 */

import { existsSync, statSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { dirname, extname, join, resolve } from "path";
import { crc32 } from "zlib";

/**
 * Metadata to embed in generated images.
 */
export interface ImageMetadata {
  prompt?: string;
  model?: string;
  provider?: string;
  format?: string;
  style?: string;
  title?: string;
  generatedAt?: string;
}

/**
 * Create a PNG tEXt chunk with the given keyword and text.
 * PNG tEXt chunk format: keyword (1-79 bytes) + null byte + text
 */
function createPngTextChunk(keyword: string, text: string): Buffer {
  // Validate keyword (1-79 Latin-1 chars, no spaces at start/end)
  const safeKeyword = keyword.slice(0, 79).trim();
  const keywordBuf = Buffer.from(safeKeyword, "latin1");
  const textBuf = Buffer.from(text, "utf8");

  // Data = keyword + null + text
  const data = Buffer.concat([keywordBuf, Buffer.from([0]), textBuf]);

  // Chunk type
  const type = Buffer.from("tEXt", "ascii");

  // Length (4 bytes, big-endian)
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  // CRC32 of type + data
  const crcData = Buffer.concat([type, data]);
  const crcValue = crc32(crcData);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcValue >>> 0, 0); // >>> 0 ensures unsigned

  // Full chunk: length + type + data + crc
  return Buffer.concat([length, type, data, crcBuf]);
}

/**
 * Insert metadata text chunks into a PNG buffer.
 * Chunks are inserted after the IHDR chunk (required to be first).
 */
export function embedPngMetadata(pngBuffer: Buffer, metadata: ImageMetadata): Buffer {
  // PNG signature is 8 bytes
  const PNG_SIGNATURE_LENGTH = 8;

  // Verify PNG signature
  const signature = pngBuffer.slice(0, PNG_SIGNATURE_LENGTH);
  const expectedSig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!signature.equals(expectedSig)) {
    // Not a valid PNG, return as-is
    return pngBuffer;
  }

  // Find the end of IHDR chunk (first chunk after signature)
  // Chunk format: 4 bytes length + 4 bytes type + data + 4 bytes CRC
  const ihdrLength = pngBuffer.readUInt32BE(PNG_SIGNATURE_LENGTH);
  const ihdrEnd = PNG_SIGNATURE_LENGTH + 4 + 4 + ihdrLength + 4;

  // Create metadata chunks
  const chunks: Buffer[] = [];

  if (metadata.prompt) {
    chunks.push(createPngTextChunk("Description", metadata.prompt));
  }
  if (metadata.model) {
    chunks.push(createPngTextChunk("AI-Model", metadata.model));
  }
  if (metadata.provider) {
    chunks.push(createPngTextChunk("AI-Provider", metadata.provider));
  }
  if (metadata.format) {
    chunks.push(createPngTextChunk("Image-Format", metadata.format));
  }
  if (metadata.style) {
    chunks.push(createPngTextChunk("AI-Style", metadata.style));
  }
  if (metadata.title) {
    chunks.push(createPngTextChunk("Title", metadata.title));
  }
  if (metadata.generatedAt) {
    chunks.push(createPngTextChunk("Creation-Time", metadata.generatedAt));
  }

  // Also add software and source tags
  chunks.push(createPngTextChunk("Software", "image-generation-mcp"));
  chunks.push(createPngTextChunk("Source", "https://github.com/12-days-of-shipmas-2025/day-2-image-generation-mcp"));

  // Combine: signature + IHDR + metadata chunks + rest of file
  const beforeMetadata = pngBuffer.slice(0, ihdrEnd);
  const afterIhdr = pngBuffer.slice(ihdrEnd);
  const metadataBuffer = Buffer.concat(chunks);

  return Buffer.concat([beforeMetadata, metadataBuffer, afterIhdr]);
}

/**
 * Get file extension from MIME type.
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
  };
  return mimeToExt[mimeType] ?? ".png";
}

/**
 * Generate a default filename with timestamp.
 */
export function generateFilename(prefix: string = "image", mimeType: string = "image/png"): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const ext = getExtensionFromMimeType(mimeType);
  return `${prefix}-${timestamp}${ext}`;
}

/**
 * Sanitize a string to be safe for use as a filename.
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9-_]/g, "-") // Replace unsafe chars with dash
    .replace(/-+/g, "-") // Collapse multiple dashes
    .replace(/^-|-$/g, "") // Remove leading/trailing dashes
    .toLowerCase()
    .slice(0, 100); // Limit length
}

/**
 * Save base64 image data to a file.
 * If outputPath is a directory, generates a filename automatically.
 * If metadata is provided and the image is a PNG, embeds metadata as tEXt chunks.
 */
export async function saveImage(
  base64Data: string,
  outputPath: string,
  mimeType: string = "image/png",
  metadata?: ImageMetadata
): Promise<string> {
  // Resolve to absolute path
  let absolutePath = resolve(outputPath);

  // Check if outputPath is an existing directory or ends with a path separator
  const isDirectory =
    outputPath.endsWith("/") ||
    outputPath.endsWith("\\") ||
    (existsSync(absolutePath) && statSync(absolutePath).isDirectory());

  if (isDirectory) {
    // Generate a filename and append to the directory path
    const filename = generateFilename("blog-image", mimeType);
    absolutePath = join(absolutePath, filename);
  }

  // Ensure the directory exists
  const dir = dirname(absolutePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  // Add extension if missing
  let finalPath = absolutePath;
  if (!extname(finalPath)) {
    finalPath += getExtensionFromMimeType(mimeType);
  }

  // Decode image data
  const rawBuffer = Buffer.from(base64Data, "base64");

  // Embed metadata if provided and image is PNG
  const finalBuffer =
    metadata && mimeType === "image/png" ? embedPngMetadata(rawBuffer, metadata) : rawBuffer;

  await writeFile(finalPath, finalBuffer);

  return finalPath;
}

/**
 * Calculate approximate file size from base64 data.
 */
export function estimateFileSize(base64Data: string): number {
  // Base64 is ~4/3 the size of the original binary
  return Math.floor((base64Data.length * 3) / 4);
}

/**
 * Format file size for display.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get the default output directory for generated images.
 * Uses IMAGE_OUTPUT_DIR env var if set, otherwise falls back to cwd/generated-images.
 */
export function getDefaultOutputDir(): string {
  const envDir = process.env.IMAGE_OUTPUT_DIR;
  if (envDir) {
    return resolve(envDir);
  }
  return join(process.cwd(), "generated-images");
}

/**
 * Generate a default output path for an image.
 * Creates a timestamped filename in the default output directory.
 */
export function generateDefaultOutputPath(
  mimeType: string = "image/png",
  prefix: string = "blog-image"
): string {
  const dir = getDefaultOutputDir();
  const filename = generateFilename(prefix, mimeType);
  return join(dir, filename);
}
