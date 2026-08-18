// Re-export the native module. On web, it will be resolved to PlayIntegrityModule.web.ts
// and on native platforms to PlayIntegrityModule.ts
export { default } from "./src/PlayIntegrityModule";
export * from "./src/PlayIntegrity.types";
