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
  // The pre-Fumadocs site served docs at the root (/getting-started/faq).
  // Old bookmarks and in-app links keep working.
  async redirects() {
    return [
      ...['getting-started', 'features', 'guides', 'reference', 'backup-and-sync', 'architecture', 'development'].map(
        (section) => ({
          source: `/${section}/:slug*`,
          destination: `/docs/${section}/:slug*`,
          permanent: true,
        }),
      ),
      { source: '/privacy.html', destination: '/privacy', permanent: true },
    ];
  },
};

export default withMDX(config);
