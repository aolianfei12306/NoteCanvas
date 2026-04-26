export type ToolMode = 'browse' | 'text' | 'pen' | 'eraser' | 'export'

export interface Point {
  x: number
  y: number
}

export interface ExportRect {
  x: number
  y: number
  width: number
  height: number
}

export interface TextBlockRecord {
  id: string
  x: number
  y: number
  width: number
  height: number
  html: string
  createdAt: string
  updatedAt: string
}

export interface StrokeRecord {
  id: string
  color: string
  width: number
  opacity: number
  points: Point[]
  createdAt: string
}

export interface BoardPageRecord {
  id: string
  width: number
  height: number
  textBlocks: TextBlockRecord[]
  strokes: StrokeRecord[]
  createdAt: string
  updatedAt: string
}

export interface BoardDocument {
  pages: BoardPageRecord[]
  activePageId: string
}

interface LegacyBoardDocument {
  width?: number
  height?: number
  textBlocks?: TextBlockRecord[]
  strokes?: StrokeRecord[]
  pages?: Partial<BoardPageRecord>[]
  activePageId?: string
}

export interface FolderRecord {
  id: string
  name: string
  parentId: string | null
  createdAt: string
  updatedAt: string
}

export interface NoteRecord {
  id: string
  folderId: string
  title: string
  createdAt: string
  updatedAt: string
  revision: number
  document: BoardDocument
}

export interface LibrarySnapshot {
  schemaVersion: number
  lastOpenedNoteId: string | null
  folders: FolderRecord[]
  notes: NoteRecord[]
}

const SCHEMA_VERSION = 1
export const DEFAULT_BOARD_WIDTH = 1440
export const DEFAULT_BOARD_HEIGHT = 1800
const UNTITLED_NOTE = '?????'

function nowIso() {
  return new Date().toISOString()
}

function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

export function createFolder(name = '?????', parentId: string | null = null): FolderRecord {
  const createdAt = nowIso()

  return {
    id: makeId('folder'),
    name,
    parentId,
    createdAt,
    updatedAt: createdAt,
  }
}

export function createTextBlock(partial: Partial<TextBlockRecord> = {}): TextBlockRecord {
  const createdAt = nowIso()

  return {
    id: partial.id ?? makeId('text'),
    x: partial.x ?? 120,
    y: partial.y ?? 120,
    width: partial.width ?? 520,
    height: partial.height ?? 180,
    html: partial.html ?? '<h1>????</h1><p>????????????????????</p>',
    createdAt: partial.createdAt ?? createdAt,
    updatedAt: partial.updatedAt ?? createdAt,
  }
}

export function createBoardPage(partial: Partial<BoardPageRecord> = {}): BoardPageRecord {
  const createdAt = nowIso()

  return {
    id: partial.id ?? makeId('page'),
    width: partial.width ?? DEFAULT_BOARD_WIDTH,
    height: partial.height ?? DEFAULT_BOARD_HEIGHT,
    textBlocks: Array.isArray(partial.textBlocks) ? partial.textBlocks : [],
    strokes: Array.isArray(partial.strokes) ? partial.strokes : [],
    createdAt: partial.createdAt ?? createdAt,
    updatedAt: partial.updatedAt ?? createdAt,
  }
}

export function createBlankDocument(): BoardDocument {
  const page = createBoardPage()

  return {
    pages: [page],
    activePageId: page.id,
  }
}

export function getActivePage(document: BoardDocument) {
  return document.pages.find((page) => page.id === document.activePageId) ?? document.pages[0]
}

export function createNote(folderId: string, title = UNTITLED_NOTE, withStarterContent = false): NoteRecord {
  const createdAt = nowIso()
  const document = createBlankDocument()
  const firstPage = document.pages[0]

  if (withStarterContent) {
    firstPage.textBlocks.push(
      createTextBlock({
        x: 96,
        y: 96,
        width: 620,
        height: 240,
        html:
          '<h1>???? NoteCanvas</h1><p>??????????????????? PNG?</p><ul><li>?????????????</li><li>??????????????</li><li>???????????????????</li></ul>',
      }),
    )
  }

  return {
    id: makeId('note'),
    folderId,
    title,
    createdAt,
    updatedAt: createdAt,
    revision: 1,
    document,
  }
}

export function touchNote(note: NoteRecord, partial: Partial<NoteRecord> = {}): NoteRecord {
  return {
    ...note,
    ...partial,
    revision: (partial.revision ?? note.revision) + 1,
    updatedAt: nowIso(),
  }
}

export function sortFolders(folders: FolderRecord[]) {
  return [...folders].sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'))
}

export function sortNotes(notes: NoteRecord[]) {
  return [...notes].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  )
}

export function plainTextFromHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function deriveNoteTitle(note: NoteRecord) {
  const cleaned = note.title.trim()

  if (cleaned.length > 0 && cleaned !== UNTITLED_NOTE) {
    return cleaned
  }

  const firstBlock = note.document.pages.flatMap((page) => page.textBlocks)[0]
  if (!firstBlock) {
    return UNTITLED_NOTE
  }

  return plainTextFromHtml(firstBlock.html).slice(0, 24) || UNTITLED_NOTE
}

export function clampExportRect(rect: ExportRect, width: number, height: number): ExportRect {
  const x = Math.max(0, Math.min(rect.x, width))
  const y = Math.max(0, Math.min(rect.y, height))
  const maxWidth = Math.max(1, width - x)
  const maxHeight = Math.max(1, height - y)

  return {
    x,
    y,
    width: Math.max(1, Math.min(rect.width, maxWidth)),
    height: Math.max(1, Math.min(rect.height, maxHeight)),
  }
}

export function sanitizeFileName(input: string) {
  const cleaned = input
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return cleaned || 'note-canvas-export'
}

export function createDefaultLibrary(): LibrarySnapshot {
  const inbox = createFolder('???')
  const ideas = createFolder('???')
  const welcome = createNote(inbox.id, '???? NoteCanvas', true)

  return {
    schemaVersion: SCHEMA_VERSION,
    lastOpenedNoteId: welcome.id,
    folders: sortFolders([inbox, ideas]),
    notes: sortNotes([welcome]),
  }
}

function normalizeDocument(document: LegacyBoardDocument | null | undefined): BoardDocument {
  if (Array.isArray(document?.pages) && document.pages.length > 0) {
    const pages = document.pages.map((page) =>
      createBoardPage({
        id: page.id,
        width: page.width || DEFAULT_BOARD_WIDTH,
        height: page.height || DEFAULT_BOARD_HEIGHT,
        textBlocks: Array.isArray(page.textBlocks) ? page.textBlocks : [],
        strokes: Array.isArray(page.strokes) ? page.strokes : [],
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
      }),
    )
    const pageIds = new Set(pages.map((page) => page.id))
    const activePageId = document.activePageId && pageIds.has(document.activePageId)
      ? document.activePageId
      : pages[0].id

    return {
      pages,
      activePageId,
    }
  }

  const page = createBoardPage({
    width: document?.width || DEFAULT_BOARD_WIDTH,
    height: document?.height || DEFAULT_BOARD_HEIGHT,
    textBlocks: Array.isArray(document?.textBlocks) ? document.textBlocks : [],
    strokes: Array.isArray(document?.strokes) ? document.strokes : [],
  })

  return {
    pages: [page],
    activePageId: page.id,
  }
}

export function normalizeLibrarySnapshot(snapshot: Partial<LibrarySnapshot> | null | undefined): LibrarySnapshot {
  if (!snapshot) {
    return createDefaultLibrary()
  }

  const folders = Array.isArray(snapshot.folders)
    ? snapshot.folders.filter((folder): folder is FolderRecord => Boolean(folder?.id && folder.name))
    : []

  const notes = Array.isArray(snapshot.notes)
    ? snapshot.notes.filter((note): note is NoteRecord => Boolean(note?.id && note.folderId && note.document))
    : []

  if (folders.length === 0) {
    return createDefaultLibrary()
  }

  if (notes.length === 0) {
    const starter = createNote(folders[0].id, UNTITLED_NOTE, false)

    return {
      schemaVersion: SCHEMA_VERSION,
      lastOpenedNoteId: starter.id,
      folders: sortFolders(folders),
      notes: [starter],
    }
  }

  const allowedFolderIds = new Set(folders.map((folder) => folder.id))
  const normalizedNotes = notes.map((note) => {
    const fallbackFolderId = folders[0].id

    return {
      ...note,
      folderId: allowedFolderIds.has(note.folderId) ? note.folderId : fallbackFolderId,
      title: note.title?.trim() || UNTITLED_NOTE,
      revision: Math.max(note.revision ?? 1, 1),
      document: normalizeDocument(note.document as LegacyBoardDocument),
    }
  })

  const noteIds = new Set(normalizedNotes.map((note) => note.id))
  const lastOpenedNoteId =
    snapshot.lastOpenedNoteId && noteIds.has(snapshot.lastOpenedNoteId)
      ? snapshot.lastOpenedNoteId
      : normalizedNotes[0].id

  return {
    schemaVersion: SCHEMA_VERSION,
    lastOpenedNoteId,
    folders: sortFolders(folders),
    notes: sortNotes(normalizedNotes),
  }
}
