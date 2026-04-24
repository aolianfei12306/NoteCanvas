import type { LibrarySnapshot } from '../shared/model'

declare global {
  interface Window {
    noteCanvas: {
      loadLibrary: () => Promise<LibrarySnapshot>
      saveLibrary: (snapshot: LibrarySnapshot) => Promise<void>
      stageDragImage: (dataUrl: string, fileName: string) => Promise<string>
      startFileDrag: (filePath: string) => void
      copyImage: (dataUrl: string) => Promise<void>
      saveImageAs: (dataUrl: string, fileName: string) => Promise<string | null>
    }
  }
}

export {}
