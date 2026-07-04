import React from "react";
import type { DocsThemeConfig } from "nextra-theme-docs";

const config: DocsThemeConfig = {
  logo: (
    <span style={{ fontWeight: 700, fontSize: "1.05rem", letterSpacing: "-0.01em" }}>
      Comma&nbsp;<span style={{ opacity: 0.5, fontWeight: 500 }}>Docs</span>
    </span>
  ),
  project: {
    link: "https://github.com/raiz-toff/CommaApp",
  },
  docsRepositoryBase: "https://github.com/raiz-toff/CommaApp/tree/main/docs",
  // pages/ is generated (gitignored) from docs/*.md by sync-docs.mjs, so the
  // default edit link (docsRepositoryBase + "/pages/<page>.mdx") points at a
  // path that doesn't exist in the repo. Map the generated page path back to
  // the real source: pages/getting-started/faq.mdx → docs/getting-started/faq.md
  editLink: {
    component({ children, className, filePath }) {
      const src = (filePath ?? "")
        .replace(/^pages\//, "")
        .replace(/\.mdx$/, ".md");
      return (
        <a
          href={`https://github.com/raiz-toff/CommaApp/edit/main/docs/${src}`}
          className={className}
          target="_blank"
          rel="noreferrer"
        >
          {children}
        </a>
      );
    },
  },
  navbar: {
    extraContent: (
      <a
        href="https://comma-psi.vercel.app"
        target="_blank"
        rel="noreferrer"
        style={{ fontSize: "0.875rem", fontWeight: 600, whiteSpace: "nowrap" }}
      >
        Open Web App ↗
      </a>
    ),
  },
  footer: {
    content: (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          width: "100%",
        }}
      >
        <span>MIT Licensed · Comma — privacy-first earnings tracker for gig workers.</span>
        <span style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
          <a href="https://comma-psi.vercel.app" target="_blank" rel="noreferrer">
            Web App
          </a>
          <a
            href="https://github.com/raiz-toff/CommaApp/releases/latest"
            target="_blank"
            rel="noreferrer"
          >
            Android APK
          </a>
          <a href="https://github.com/raiz-toff/CommaApp" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href="/privacy">Privacy</a>
        </span>
      </div>
    ),
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="description" content="Documentation for Comma, a privacy-first earnings tracker for gig workers." />
      <meta property="og:site_name" content="Comma Docs" />
      <meta property="og:title" content="Comma Docs" />
      <meta property="og:description" content="Documentation for Comma, a privacy-first earnings tracker for gig workers." />
    </>
  ),
  color: {
    hue: 145,
    saturation: 70,
  },
  sidebar: {
    defaultMenuCollapseLevel: 1,
  },
  navigation: { prev: true, next: true },
};

export default config;
