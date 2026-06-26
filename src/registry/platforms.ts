/**
 * @deprecated Use `@/src/registry/platforms` (the new modular registry) instead.
 * This file is kept as a backward-compat re-export shim.
 * All platform definitions now live in src/registry/platforms/*.ts
 */

export {
  PLATFORMS,
  PLATFORM_REGISTRY,
  getPlatformDef,
  getPlatformsByCountry,
  resolveMarketPlatformIds,
  type PlatformDef,
  type PlatformKey,
} from "./platforms/index";
