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
  footer: {
    content: (
      <span>
        MIT Licensed · Comma — privacy-first earnings tracker for gig workers.
      </span>
    ),
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="description" content="Documentation for Comma, a privacy-first earnings tracker for gig workers." />
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
