import path from 'node:path'
import { promises as fs } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  nativeImage,
} from 'electron'
import {
  createDefaultLibrary,
  normalizeLibrarySnapshot,
  sanitizeFileName,
  type LibrarySnapshot,
} from '../shared/model'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const workspacePath = path.join(app.getPath('userData'), 'workspace')
const libraryPath = path.join(workspacePath, 'library.json')
const dragExportPath = path.join(app.getPath('temp'), 'note-canvas-exports')
const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
}

async function ensureDirectory(targetPath: string) {
  await fs.mkdir(targetPath, { recursive: true })
}

function dataUrlToBuffer(dataUrl: string) {
  const encoded = dataUrl.replace(/^data:image\/png;base64,/, '')
  return Buffer.from(encoded, 'base64')
}

async function loadLibrary() {
  await ensureDirectory(workspacePath)

  try {
    const raw = await fs.readFile(libraryPath, 'utf8')
    const parsed = JSON.parse(raw) as Partial<LibrarySnapshot>

    return normalizeLibrarySnapshot(parsed)
  } catch {
    const initial = createDefaultLibrary()
    await saveLibrary(initial)
    return initial
  }
}

async function saveLibrary(snapshot: LibrarySnapshot) {
  await ensureDirectory(workspacePath)
  const normalized = normalizeLibrarySnapshot(snapshot)
  await fs.writeFile(libraryPath, JSON.stringify(normalized, null, 2), 'utf8')
}

async function stageDragImage(dataUrl: string, fileName: string) {
  await ensureDirectory(dragExportPath)

  const targetPath = path.join(
    dragExportPath,
    `${sanitizeFileName(fileName)}-${Date.now()}.png`,
  )

  await fs.writeFile(targetPath, dataUrlToBuffer(dataUrl))
  return targetPath
}

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1680,
    height: 1040,
    minWidth: 1260,
    minHeight: 760,
    backgroundColor: '#f4ede3',
    title: 'NoteCanvas',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      sandbox: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    window.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    window.loadFile('dist/index.html')
  }

  return window
}

if (hasSingleInstanceLock) {
  app.whenReady().then(async () => {
    await ensureDirectory(dragExportPath)
    await loadLibrary()
    createMainWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow()
      }
    })
  })

  app.on('second-instance', () => {
    const existing = BrowserWindow.getAllWindows()[0]
    if (!existing) {
      return
    }

    if (existing.isMinimized()) {
      existing.restore()
    }

    existing.focus()
  })
}

app.on('window-all-closed', () => {
  app.quit()
})

process.on('message', (message) => {
  if (message === 'electron-vite&type=hot-reload') {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.reload()
    }
  }
})

ipcMain.handle('library:load', async () => loadLibrary())
ipcMain.handle('library:save', async (_, snapshot: LibrarySnapshot) => saveLibrary(snapshot))

ipcMain.handle('image:stage-drag', async (_, dataUrl: string, fileName: string) =>
  stageDragImage(dataUrl, fileName),
)

ipcMain.on('image:start-drag', (event, filePath: string) => {
  event.sender.startDrag({
    file: filePath,
    icon: nativeImage.createFromPath(filePath),
  })
})

ipcMain.handle('image:copy', async (_, dataUrl: string) => {
  clipboard.writeImage(nativeImage.createFromDataURL(dataUrl))
})

ipcMain.handle('image:save-dialog', async (_, dataUrl: string, fileName: string) => {
  const result = await dialog.showSaveDialog({
    title: '导出 PNG',
    defaultPath: path.join(app.getPath('downloads'), `${sanitizeFileName(fileName)}.png`),
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
  })

  if (result.canceled || !result.filePath) {
    return null
  }

  await fs.writeFile(result.filePath, dataUrlToBuffer(dataUrl))
  return result.filePath
})
