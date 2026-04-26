import { spawn, type ChildProcess } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import { defineConfig } from 'vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
let electronApp: ChildProcess | null = null
let hookedProcessExit = false
let restartTimer: ReturnType<typeof setTimeout> | null = null
let restartTask: Promise<void> | null = null
let shuttingDown = false

async function stopElectronProcess() {
  if (!electronApp) {
    return
  }

  const currentApp = electronApp
  electronApp = null
  currentApp.removeAllListeners('exit')

  if (currentApp.exitCode !== null || currentApp.killed) {
    return
  }

  await new Promise<void>((resolve) => {
    currentApp.once('exit', () => resolve())

    try {
      currentApp.kill()
    } catch {
      resolve()
    }
  })
}

async function startElectronProcess() {
  if (restartTask || shuttingDown) {
    return
  }

  restartTask = (async () => {
    await stopElectronProcess()

    const electronPath = require('electron') as string

    const nextElectronApp = spawn(electronPath, ['.', '--no-sandbox'], {
      stdio: 'inherit',
      cwd: rootDir,
    })
    electronApp = nextElectronApp

    nextElectronApp.once('error', (error) => {
      console.error('[electron] spawn failed:', error)
    })

    nextElectronApp.once('exit', (code) => {
      if (electronApp === nextElectronApp) {
        electronApp = null
      }

      if (!shuttingDown) {
        shuttingDown = true
        if (restartTimer) {
          clearTimeout(restartTimer)
          restartTimer = null
        }
        process.exit(code ?? 0)
      }
    })
  })()

  try {
    await restartTask
  } finally {
    restartTask = null
  }

  hookProcessExit()
}

function exitCodeForSignal(signal: NodeJS.Signals) {
  return signal === 'SIGINT' ? 130 : 143
}

function hookProcessExit() {
  if (hookedProcessExit) {
    return
  }

  hookedProcessExit = true
  process.once('exit', () => {
    void stopElectronProcess()
  })

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, async () => {
      shuttingDown = true
      if (restartTimer) {
        clearTimeout(restartTimer)
        restartTimer = null
      }

      await stopElectronProcess()
      process.exit(exitCodeForSignal(signal))
    })
  }
}

function scheduleElectronRestart() {
  if (restartTimer) {
    clearTimeout(restartTimer)
  }

  restartTimer = setTimeout(() => {
    restartTimer = null
    void startElectronProcess()
  }, 180)
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        onstart: () => {
          scheduleElectronRestart()
        },
        vite: {
          build: {
            outDir: 'dist-electron/main',
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart: () => {
          scheduleElectronRestart()
        },
        vite: {
          build: {
            outDir: 'dist-electron/preload',
          },
        },
      },
    ]),
  ],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
      '@shared': path.resolve(rootDir, 'shared'),
    },
  },
})
