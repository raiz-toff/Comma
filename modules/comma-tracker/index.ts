// Re-export the native module. On web, it will be resolved to CommaTrackerModule.web.ts
// and on native platforms to CommaTrackerModule.ts
export { default } from './src/CommaTrackerModule';
export * from './src/CommaTracker.types';
