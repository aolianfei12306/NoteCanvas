import { describe, expect, it } from 'vitest'
import {
  clampExportRect,
  createBlankDocument,
  createDefaultLibrary,
  normalizeLibrarySnapshot,
  sanitizeFileName,
} from './model'

describe('createDefaultLibrary', () => {
  it('creates a starter workspace with folders and one note', () => {
    const snapshot = createDefaultLibrary()

    expect(snapshot.folders.length).toBeGreaterThanOrEqual(2)
    expect(snapshot.notes).toHaveLength(1)
    expect(snapshot.lastOpenedNoteId).toBe(snapshot.notes[0].id)
    expect(snapshot.notes[0].document.pages).toHaveLength(1)
    expect(snapshot.notes[0].document.pages[0].layers).toHaveLength(1)
  })
})

describe('createBlankDocument', () => {
  it('creates one active page', () => {
    const document = createBlankDocument()

    expect(document.pages).toHaveLength(1)
    expect(document.activePageId).toBe(document.pages[0].id)
    expect(document.pages[0].activeLayerId).toBe(document.pages[0].layers[0].id)
  })
})

describe('normalizeLibrarySnapshot', () => {
  it('creates a fallback note when notes are missing', () => {
    const normalized = normalizeLibrarySnapshot({
      folders: [
        {
          id: 'folder_1',
          name: 'Only Folder',
          parentId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      notes: [],
    })

    expect(normalized.notes).toHaveLength(1)
    expect(normalized.notes[0].folderId).toBe('folder_1')
  })

  it('migrates a legacy single-board document into one page', () => {
    const normalized = normalizeLibrarySnapshot({
      folders: [
        {
          id: 'folder_1',
          name: 'Only Folder',
          parentId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      notes: [
        {
          id: 'note_1',
          folderId: 'folder_1',
          title: 'Legacy',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          revision: 1,
          document: {
            width: 300,
            height: 400,
            textBlocks: [
              {
                id: 'text_1',
                x: 0,
                y: 0,
                width: 100,
                height: 100,
                html: '<p>Legacy</p>',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
            strokes: [
              {
                id: 'stroke_1',
                color: '#111827',
                width: 4,
                opacity: 1,
                points: [{ x: 0, y: 0 }],
                createdAt: new Date().toISOString(),
              },
            ],
          } as never,
        },
      ],
    })

    expect(normalized.notes[0].document.pages).toHaveLength(1)
    expect(normalized.notes[0].document.pages[0].width).toBe(300)
    expect(normalized.notes[0].document.pages[0].height).toBe(400)
    expect(normalized.notes[0].document.pages[0].textBlocks[0].layerId).toBe(
      normalized.notes[0].document.pages[0].activeLayerId,
    )
    expect(normalized.notes[0].document.pages[0].strokes[0].layerId).toBe(
      normalized.notes[0].document.pages[0].activeLayerId,
    )
  })
})

describe('sanitizeFileName', () => {
  it('replaces invalid characters', () => {
    expect(sanitizeFileName('设计稿 / v1: 首页?')).toBe('设计稿-v1-首页')
  })
})

describe('clampExportRect', () => {
  it('keeps selection inside the board', () => {
    expect(clampExportRect({ x: -10, y: 20, width: 5000, height: 30 }, 300, 200)).toEqual({
      x: 0,
      y: 20,
      width: 300,
      height: 30,
    })
  })
})
