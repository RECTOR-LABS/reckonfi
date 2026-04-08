#!/usr/bin/env bun
/**
 * Build script for ReckonFi ElizaOS project
 */

import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';

async function cleanBuild(outdir = 'dist') {
  if (existsSync(outdir)) {
    await rm(outdir, { recursive: true, force: true });
    console.log(`Cleaned ${outdir} directory`);
  }
}

async function build() {
  const start = performance.now();
  console.log('Building ReckonFi plugin...');

  try {
    await cleanBuild('dist');

    const result = await Bun.build({
      entrypoints: ['./src/index.ts'],
      outdir: './dist',
      target: 'node',
      format: 'esm',
      sourcemap: true,
      minify: false,
      external: [
        'dotenv',
        'fs',
        'path',
        'https',
        'node:*',
        '@elizaos/core',
        '@elizaos/plugin-bootstrap',
        '@elizaos/plugin-sql',
        '@elizaos/cli',
        '@solana/web3.js',
        '@solana/spl-token',
        'bs58',
        'zod',
      ],
      naming: {
        entry: '[dir]/[name].[ext]',
      },
    });

    if (!result.success) {
      console.error('Build failed:', result.logs);
      return false;
    }

    const totalSize = result.outputs.reduce((sum, output) => sum + output.size, 0);
    const sizeMB = (totalSize / 1024 / 1024).toFixed(2);
    console.log(`Built ${result.outputs.length} file(s) - ${sizeMB}MB`);

    const elapsed = ((performance.now() - start) / 1000).toFixed(2);
    console.log(`Build complete! (${elapsed}s)`);
    return true;
  } catch (error) {
    console.error('Build error:', error);
    return false;
  }
}

build().then((success) => {
  if (!success) process.exit(1);
}).catch((error) => {
  console.error('Build script error:', error);
  process.exit(1);
});
