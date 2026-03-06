// Mock for 'server-only' package in test environments.
// The real package throws when imported outside Next.js server context.
// In tests, we skip the check — the modules are tested in Node.js environment.
export {}
