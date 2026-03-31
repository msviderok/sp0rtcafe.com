import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const exportPath = process.argv[2] ?? "/Users/msv/Downloads/selected-rows.json";
const convexUrl = process.env.VITE_CONVEX_URL;

if (!convexUrl) {
  throw new Error("VITE_CONVEX_URL is required");
}

function inferMimeType(fileName) {
  const extension = path.extname(fileName).toLowerCase();

  switch (extension) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    case ".mp3":
      return "audio/mpeg";
    default:
      return undefined;
  }
}

function isImageFile(fileName) {
  return /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(fileName);
}

function getImageDimensions(filePath) {
  const output = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", filePath], {
    encoding: "utf8",
  });

  const width = Number(output.match(/pixelWidth:\s+(\d+)/)?.[1]);
  const height = Number(output.match(/pixelHeight:\s+(\d+)/)?.[1]);

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`Failed to read image dimensions for ${filePath}`);
  }

  return { width, height };
}

const rows = JSON.parse(await readFile(exportPath, "utf8"));
const spritePaths = execFileSync("rg", ["--files", "src/sprites"], {
  encoding: "utf8",
})
  .trim()
  .split("\n")
  .filter(Boolean);

const localPathByName = new Map(spritePaths.map((spritePath) => [path.basename(spritePath), spritePath]));
const unmatched = [];
const files = rows.map((row) => {
  const localPath = localPathByName.get(row.name);
  const dimensions =
    localPath && isImageFile(row.name) ? getImageDimensions(path.resolve(localPath)) : undefined;

  if (!localPath && isImageFile(row.name)) {
    unmatched.push(row.name);
  }

  return {
    uploadThingKey: row.key,
    fileName: row.name,
    url: row.url,
    size: row.size,
    ...(inferMimeType(row.name) ? { mimeType: inferMimeType(row.name) } : {}),
    ...(row.uploadedAt ? { uploadedAt: Date.parse(row.uploadedAt) } : {}),
    status: "uploaded",
    progress: 100,
    ...(dimensions ? { width: dimensions.width, height: dimensions.height } : {}),
  };
});

const client = new ConvexHttpClient(convexUrl);
await client.mutation(api.files.upsertUploadThingFiles, {
  files,
  createSprites: true,
});

console.log(
  JSON.stringify(
    {
      imported: files.length,
      withLocalDimensions: files.filter((file) => file.width && file.height).length,
      unmatchedImageFiles: unmatched,
    },
    null,
    2,
  ),
);
