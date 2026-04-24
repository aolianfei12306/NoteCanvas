import { contextBridge, ipcRenderer } from 'electron'
import type { LibrarySnapshot } from '../shared/model'

contextBridge.exposeInMainWorld('noteCanvas', {
  loadLibrary: () => ipcRenderer.invoke('library:load') as Promise<LibrarySnapshot>,
  saveLibrary: (snapshot: LibrarySnapshot) =>
    ipcRenderer.invoke('library:save', snapshot) as Promise<void>,
  stageDragImage: (dataUrl: string, fileName: string) =>
    ipcRenderer.invoke('image:stage-drag', dataUrl, fileName) as Promise<string>,
  startFileDrag: (filePath: string) => ipcRenderer.send('image:start-drag', filePath),
  copyImage: (dataUrl: string) => ipcRenderer.invoke('image:copy', dataUrl) as Promise<void>,
  saveImageAs: (dataUrl: string, fileName: string) =>
    ipcRenderer.invoke('image:save-dialog', dataUrl, fileName) as Promise<string | null>,
})
