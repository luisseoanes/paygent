import { defineConfig } from 'vitest/config'

// Tests always run against mocked Open Payments, whatever the root .env says (env.ts reads it on import).
export default defineConfig({ test: { env: { MOCK_OP: '1' } } })
