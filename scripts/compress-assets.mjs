#!/usr/bin/env node

import { existsSync, renameSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const assets = [
  'public/map.glb',
  'public/idle.glb',
  'public/knight.glb',
  'public/walk.glb',
  'public/death.glb',
]

const cliEntry = resolve('node_modules/@gltf-transform/cli/bin/cli.js')

for (const asset of assets) {
  const inputPath = resolve(asset)
  const tempPath = `${inputPath}.meshopt.glb`

  if (!existsSync(inputPath)) {
    console.warn(`Skipping missing asset: ${asset}`)
    continue
  }

  rmSync(tempPath, { force: true })

  const result = spawnSync(
    process.execPath,
    [
      cliEntry,
      'meshopt',
      inputPath,
      tempPath,
      '--level',
      'high',
      '--quantize-position',
      '14',
      '--quantize-normal',
      '10',
      '--quantize-texcoord',
      '12',
    ],
    {
      stdio: 'inherit',
      shell: false,
    },
  )

  if (result.status !== 0) {
    rmSync(tempPath, { force: true })
    throw new Error(
      `Compression failed for ${asset}: ${result.error?.message ?? `exit code ${result.status ?? 'unknown'}`}`,
    )
  }

  renameSync(tempPath, inputPath)
  console.log(`Compressed ${asset}`)
}