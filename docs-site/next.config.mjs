import { createMDX } from 'fumadocs-mdx/next';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // The repo root also has a lockfile; pin the workspace root to this app so
  // Next doesn't infer the monorepo root.
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
};

export default withMDX(config);
