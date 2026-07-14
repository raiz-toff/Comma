import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import * as DocVisuals from '@/components/doc-visuals';
import * as FaqKit from '@/components/faq-kit';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    // The docs illustration kit (AGENTS.md §4). Registered globally so a page in
    // docs/ can drop in <StatRow ... /> with no import line.
    ...DocVisuals,
    // The FAQ page's own kit (content/custom/faq.mdx) — that page is hand-authored
    // and exempt from the one-visual house style, so it gets richer components.
    ...FaqKit,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
