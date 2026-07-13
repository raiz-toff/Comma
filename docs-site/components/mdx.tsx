import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import * as DocVisuals from '@/components/doc-visuals';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    // The docs illustration kit (AGENTS.md §4). Registered globally so a page in
    // docs/ can drop in <StatRow ... /> with no import line.
    ...DocVisuals,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
