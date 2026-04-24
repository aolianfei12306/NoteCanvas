import { describe, expect, it } from 'vitest'
import {
  clampExportRect,
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
