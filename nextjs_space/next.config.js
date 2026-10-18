const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  output: process.env.NEXT_OUTPUT_MODE,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: { unoptimized: true },
  // Workspace packages ship raw TypeScript.
  transpilePackages: ['@fotoai/api', '@fotoai/contracts', '@fotoai/core', '@fotoai/db', '@fotoai/env'],
  experimental: {
    // pnpm workspace: trace server files from the repo root so the standalone output
    // includes workspace packages and the hoisted node_modules.
    outputFileTracingRoot: path.join(__dirname, '..'),
  },
};

module.exports = nextConfig;
