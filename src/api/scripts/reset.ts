/** DEMO-01 por consola: `pnpm reset` (con `--full` también borra el grant de Juan). */
import { env } from '../src/env.ts'
import { demoClient } from './demo-client.ts'

const call = await demoClient(process.env.API_URL ?? `http://localhost:${env.PORT}`)
console.log(await call('/demo/reset', { full: process.argv.includes('--full') }))
