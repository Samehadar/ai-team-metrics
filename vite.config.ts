/// <reference types="vitest/config" />
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type ProxyOptions } from 'vite'

function loadOptionalEnvFile(filePath: string) {
  if (!existsSync(filePath)) return
  const raw = readFileSync(filePath, 'utf-8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) {
      process.env[key] = val
    }
  }
}

loadOptionalEnvFile(resolve(process.cwd(), '.env.local'))
loadOptionalEnvFile(resolve(process.cwd(), '.env.activity'))

function buildProxy(): Record<string, ProxyOptions> {
  const proxy: Record<string, ProxyOptions> = {}
  const target = process.env.VITE_ACTIVITY_PROXY_TARGET
  const path = process.env.VITE_ACTIVITY_PROXY_PATH || '/activity-api'
  if (target) {
    proxy[path] = {
      target,
      changeOrigin: true,
      rewrite: (p: string) => p.replace(new RegExp('^' + path), ''),
    }
  }
  return proxy
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: buildProxy(),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
