import { readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const terrainDir = path.resolve("public", "terrain");

const entries = await readdir(terrainDir, { withFileTypes: true });
const pngFiles = entries
  .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === ".png")
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right));

if (pngFiles.length === 0) {
  console.log("No terrain PNG files found.");
  process.exit(0);
}

for (const pngFile of pngFiles) {
  const inputPath = path.join(terrainDir, pngFile);
  const outputPath = path.join(terrainDir, `${path.basename(pngFile, ".png")}.webp`);
  await sharp(inputPath).webp({ quality: 85 }).toFile(outputPath);
  console.log(`${pngFile} -> ${path.basename(outputPath)}`);
}