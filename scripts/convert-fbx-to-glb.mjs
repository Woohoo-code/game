#!/usr/bin/env node

import { existsSync, renameSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const convert = require("fbx2gltf");

const assets = [
  {
    input: "public/Knight D Pelegrini.fbx",
    output: "public/knight.glb",
  },
  {
    input: "public/death.fbx",
    output: "public/death.glb",
  },
];

const cliEntry = resolve("node_modules/@gltf-transform/cli/bin/cli.js");

function meshoptCompress(assetPath) {
  const inputPath = resolve(assetPath);
  const tempPath = `${inputPath}.meshopt.glb`;

  rmSync(tempPath, { force: true });

  const result = spawnSync(
    process.execPath,
    [
      cliEntry,
      "meshopt",
      inputPath,
      tempPath,
      "--level",
      "high",
      "--quantize-position",
      "14",
      "--quantize-normal",
      "10",
      "--quantize-texcoord",
      "12",
    ],
    {
      stdio: "inherit",
      shell: false,
    },
  );

  if (result.status !== 0) {
    rmSync(tempPath, { force: true });
    throw new Error(
      `Compression failed for ${assetPath}: ${result.error?.message ?? `exit code ${result.status ?? "unknown"}`}`,
    );
  }

  renameSync(tempPath, inputPath);
  console.log(`Compressed ${assetPath}`);
}

for (const asset of assets) {
  const inputPath = resolve(asset.input);
  const outputPath = resolve(asset.output);

  if (!existsSync(inputPath)) {
    throw new Error(`Asset not found: ${asset.input}`);
  }

  rmSync(outputPath, { force: true });
  console.log(`Converting ${asset.input} -> ${asset.output}`);
  await convert(inputPath, outputPath, ["--binary"]);
  meshoptCompress(asset.output);
}