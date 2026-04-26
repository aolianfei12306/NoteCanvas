import { useEffect, useMemo, useRef, useState } from 'react'
import { Settings } from 'lucide-react'
import { normalizeLibrarySnapshot, createFolder, createNote, deriveNoteTitle, sortFolders, sortNotes, touchNote, type LibrarySnapshot, type NoteRecord, type PenToolMode, type ToolMode } from '../shared/model'
import { EditorToolbar } from './components/EditorToolbar'
import { BoardEditor } from './components/BoardEditor'
import { Sidebar } from './components/Sidebar'
import { SettingsPanel } from './components/SettingsPanel'
import { applyTextFormat, type TextFormatCommand } from './lib/textFormat'
import { applyTheme, loadAppSettings, saveAppSettings, type AppSettings } from './lib/settings'

function hotkeyMatches(event: KeyboardEvent, hotkey: string) {
  const normalized = hotkey.toLowerCase().replace(/\s+/g, '')
  const key = normalized.endsWith('++') ? '+' : normalized.split('+').at(-1)
  const wantsCtrl = normalized.includes('ctrl+')
  const wantsShift = normalized.includes('shift+')
  const wantsAlt = normalized.includes('alt+')
  const wantsMeta = normalized.includes('meta+') || normalized.includes('cmd+')
  const eventKey = event.key.length === 1 ? event.key.toLowerCase() : event.key.toLowerCase()

  return (
    eventKey === key &&
    event.ctrlKey === wantsCtrl &&
    event.shiftKey === wantsShift &&
    event.altKey === wantsAlt &&
    event.metaKey === wantsMeta
  )
}

function App() {
  const [settings, setSettings] = useState(loadAppSettings)
  const [library, setLibrary] = useState<LibrarySnapshot | null>(null)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [tool, setTool] = useState<ToolMode>('browse')
  const [penTool, setPenTool] = useState<PenToolMode>('freehand')
  const [fillShapes, setFillShapes] = useState(false)
  const [penColor, setPenColor] = useState(settings.defaultPenColor)
  const [penWidth, setPenWidth] = useState(settings.defaultPenWidth)
  const [activeTextBlockId, setActiveTextBlockId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dataPath, setDataPath] = useState<string | null>(null)
  const skipNextSaveRef = useRef(true)
  const historyByNoteRef = useRef(new Map<string, { past: NoteRecord[]; future: NoteRecord[] }>())
  const applyingHistoryRef = useRef(false)
  const [, setHistoryVersion] = useState(0)

  useEffect(() => {
    async function bootstrap() {
      try {
        const bridge = window.noteCanvas
        if (!bridge || typeof bridge.loadLibrary !== 'function') {
          throw new Error('桌面桥接未加载，请先关闭所有 npm run dev 进程后重启。')
        }

        const loaded = normalizeLibrarySnapshot(await bridge.loadLibrary())
        setLibrary(loaded)
        setSelectedFolderId(loaded.notes.find((note) => note.id === loaded.lastOpenedNoteId)?.folderId ?? loaded.folders[0]?.id ?? null)
        setSelectedNoteId(loaded.lastOpenedNoteId ?? loaded.notes[0]?.id ?? null)
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : '加载本地工作库失败')
      }
    }

    bootstrap()
  }, [])

  useEffect(() => {
    if (!library || !selectedNoteId) {
      return
    }

    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false
      return
    }

    const timer = window.setTimeout(async () => {
      try {
        setSaveState('saving')
        await window.noteCanvas.saveLibrary({
          ...library,
          lastOpenedNoteId: selectedNoteId,
        })
        setSaveState('saved')
      } catch {
        setSaveState('error')
      }
    }, Math.max(250, settings.autosaveIntervalMs))

    return () => window.clearTimeout(timer)
  }, [library, selectedNoteId, settings.autosaveIntervalMs])

  useEffect(() => {
    applyTheme(settings.theme)
  }, [settings.theme])

  useEffect(() => {
    if (!settingsOpen) {
      return
    }

    window.noteCanvas.getDataPath().then(setDataPath).catch(() => setDataPath('无法读取数据目录'))
  }, [settingsOpen])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (hotkeyMatches(event, settings.hotkeys.undo)) {
        event.preventDefault()
        handleUndo()
        return
      }

      if (hotkeyMatches(event, settings.hotkeys.redo)) {
        event.preventDefault()
        handleRedo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  const folders = useMemo(() => (library ? sortFolders(library.folders) : []), [library])

  const allNotes = useMemo(() => {
    if (!library) {
      return []
    }

    return sortNotes(library.notes)
  }, [library])

  const notes = useMemo(() => {
    if (!library) {
      return []
    }

    return sortNotes(
      library.notes.map((note) => ({
        ...note,
        title: deriveNoteTitle(note),
      })),
    )
  }, [library])

  const notesInSelectedFolder = useMemo(
    () => notes.filter((note) => note.folderId === selectedFolderId),
    [notes, selectedFolderId],
  )

  const currentNote =
    allNotes.find((note) => note.id === selectedNoteId) ??
    (selectedFolderId ? allNotes.find((note) => note.folderId === selectedFolderId) ?? null : allNotes[0] ?? null)

  const currentFolderName =
    folders.find((folder) => folder.id === (currentNote?.folderId ?? selectedFolderId))?.name ?? '未分组'
  const currentNoteStats = currentNote
    ? currentNote.document.pages.reduce(
        (stats, page) => ({
          pages: stats.pages + 1,
          textBlocks: stats.textBlocks + page.textBlocks.length,
          strokes: stats.strokes + page.strokes.length,
          shapes: stats.shapes + page.shapes.length,
        }),
        { pages: 0, textBlocks: 0, strokes: 0, shapes: 0 },
      )
    : { pages: 0, textBlocks: 0, strokes: 0, shapes: 0 }
  const currentHistory = selectedNoteId ? historyByNoteRef.current.get(selectedNoteId) : null
  const canUndo = Boolean(currentHistory?.past.length)
  const canRedo = Boolean(currentHistory?.future.length)

  function updateLibrary(transformer: (previous: LibrarySnapshot) => LibrarySnapshot) {
    setLibrary((previous) => {
      if (!previous) {
        return previous
      }

      return transformer(previous)
    })
  }

  function handleCreateFolder() {
    const folder = createFolder(`文件夹 ${folders.length + 1}`)
    const note = createNote(folder.id, '新建笔记', false)

    updateLibrary((previous) => ({
      ...previous,
      folders: sortFolders([...previous.folders, folder]),
      notes: sortNotes([note, ...previous.notes]),
      lastOpenedNoteId: note.id,
    }))

    skipNextSaveRef.current = false
    setSelectedFolderId(folder.id)
    setSelectedNoteId(note.id)
    setActiveTextBlockId(null)
  }

  function handleRenameFolder(folderId: string, name: string) {
    const nextName = name.trim()
    if (!nextName) {
      return
    }

    updateLibrary((previous) => ({
      ...previous,
      folders: previous.folders.map((folder) =>
        folder.id === folderId
          ? {
              ...folder,
              name: nextName,
              updatedAt: new Date().toISOString(),
            }
          : folder,
      ),
    }))
  }

  function handleDeleteFolder(folderId: string) {
    if (!library) {
      return
    }

    if (library.folders.length === 1) {
      window.alert('至少保留一个文件夹。')
      return
    }

    if (!window.confirm('删除文件夹后，里面的笔记会移动到其他文件夹。确定继续吗？')) {
      return
    }

    const fallbackFolder = library.folders.find((folder) => folder.id !== folderId)
    if (!fallbackFolder) {
      return
    }

    updateLibrary((previous) => ({
      ...previous,
      folders: previous.folders.filter((folder) => folder.id !== folderId),
      notes: previous.notes.map((note) =>
        note.folderId === folderId ? touchNote(note, { folderId: fallbackFolder.id }) : note,
      ),
    }))

    if (selectedFolderId === folderId) {
      setSelectedFolderId(fallbackFolder.id)
    }
  }

  function handleCreateNote() {
    if (!selectedFolderId) {
      return
    }

    const note = createNote(selectedFolderId, '新建笔记', false)

    updateLibrary((previous) => ({
      ...previous,
      notes: sortNotes([note, ...previous.notes]),
      lastOpenedNoteId: note.id,
    }))

    setSelectedNoteId(note.id)
    setActiveTextBlockId(null)
  }

  function handleDeleteNote(noteId: string) {
    if (!library) {
      return
    }

    if (!window.confirm('删除这条笔记？')) {
      return
    }

    if (library.notes.length === 1) {
      const replacement = createNote(selectedFolderId ?? library.folders[0].id, '新建笔记', false)

      updateLibrary((previous) => ({
        ...previous,
        notes: [replacement],
        lastOpenedNoteId: replacement.id,
      }))

      setSelectedNoteId(replacement.id)
      return
    }

    const remaining = library.notes.filter((note) => note.id !== noteId)
    const fallback = sortNotes(remaining).find((note) => note.folderId === selectedFolderId) ?? sortNotes(remaining)[0]

    updateLibrary((previous) => ({
      ...previous,
      notes: previous.notes.filter((note) => note.id !== noteId),
      lastOpenedNoteId: fallback?.id ?? null,
    }))

    setSelectedNoteId(fallback?.id ?? null)
    setActiveTextBlockId(null)
  }

  function handleCurrentNoteChange(nextNote: NoteRecord) {
    if (!applyingHistoryRef.current) {
      const previousNote = allNotes.find((note) => note.id === nextNote.id)
      if (previousNote && previousNote !== nextNote) {
        const history = historyByNoteRef.current.get(nextNote.id) ?? { past: [], future: [] }
        historyByNoteRef.current.set(nextNote.id, {
          past: [...history.past, previousNote].slice(-80),
          future: [],
        })
        setHistoryVersion((version) => version + 1)
      }
    }

    updateLibrary((previous) => ({
      ...previous,
      notes: sortNotes(previous.notes.map((note) => (note.id === nextNote.id ? nextNote : note))),
      lastOpenedNoteId: nextNote.id,
    }))
  }

  function applyHistoryNote(nextNote: NoteRecord) {
    applyingHistoryRef.current = true
    handleCurrentNoteChange(nextNote)
    applyingHistoryRef.current = false
    setHistoryVersion((version) => version + 1)
  }

  function handleUndo() {
    if (!currentNote) {
      return
    }

    const history = historyByNoteRef.current.get(currentNote.id)
    const previousNote = history?.past.at(-1)
    if (!history || !previousNote) {
      return
    }

    historyByNoteRef.current.set(currentNote.id, {
      past: history.past.slice(0, -1),
      future: [currentNote, ...history.future],
    })
    applyHistoryNote(previousNote)
  }

  function handleRedo() {
    if (!currentNote) {
      return
    }

    const history = historyByNoteRef.current.get(currentNote.id)
    const nextNote = history?.future[0]
    if (!history || !nextNote) {
      return
    }

    historyByNoteRef.current.set(currentNote.id, {
      past: [...history.past, currentNote].slice(-80),
      future: history.future.slice(1),
    })
    applyHistoryNote(nextNote)
  }

  function handleFormat(command: TextFormatCommand) {
    applyTextFormat(command)
  }

  function handleSettingsChange(nextSettings: AppSettings) {
    setSettings(nextSettings)
    saveAppSettings(nextSettings)
  }

  function handleToolChange(nextTool: ToolMode) {
    setTool(nextTool)

    if (nextTool !== 'browse' && nextTool !== 'text') {
      setActiveTextBlockId(null)
    }
  }

  if (loadError) {
    return (
      <main className="app loading-screen">
        <div className="loading-card">
          <h2>启动失败</h2>
          <p>{loadError}</p>
        </div>
      </main>
    )
  }

  if (!library) {
    return (
      <main className="app loading-screen">
        <div className="loading-card">
          <h2>正在打开工作区…</h2>
          <p>本地离线数据正在准备。</p>
        </div>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <Sidebar
        folders={folders}
        notes={notes}
        selectedFolderId={selectedFolderId}
        selectedNoteId={selectedNoteId}
        onSelectFolder={(folderId) => {
          setSelectedFolderId(folderId)
          const fallback = notes.find((note) => note.folderId === folderId)
          setSelectedNoteId(fallback?.id ?? null)
          setActiveTextBlockId(null)
        }}
        onCreateFolder={handleCreateFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
        onCreateNote={handleCreateNote}
        onSelectNote={(noteId) => {
          const next = allNotes.find((note) => note.id === noteId)
          if (next) {
            setSelectedFolderId(next.folderId)
          }
          setSelectedNoteId(noteId)
          setActiveTextBlockId(null)
        }}
        onDeleteNote={handleDeleteNote}
      />

      <section className="editor-panel">
        <header className="editor-header">
          <div>
            <p className="eyebrow">{currentFolderName}</p>
            {currentNote ? (
              <input
                className="note-title-input"
                value={currentNote.title === '未命名笔记' ? '' : currentNote.title}
                onChange={(event) =>
                  handleCurrentNoteChange(
                    touchNote(currentNote, {
                      title: event.target.value || '未命名笔记',
                    }),
                  )
                }
                placeholder="给这条笔记起个标题"
              />
            ) : (
              <div className="empty-editor-title">这个文件夹里还没有笔记</div>
            )}
          </div>
          <div className="header-summary">
            <span>{notesInSelectedFolder.length} 条笔记</span>
            <span>{currentNoteStats.pages} 页</span>
            <span>{currentNoteStats.textBlocks} 个文本块</span>
            <span>{currentNoteStats.strokes} 笔线条</span>
            <span>{currentNoteStats.shapes} 个图形</span>
            <button className="icon-text-button" type="button" onClick={() => setSettingsOpen(true)}>
              <Settings size={16} />
              <span>设置</span>
            </button>
          </div>
        </header>

        <EditorToolbar
          tool={tool}
          penTool={penTool}
          fillShapes={fillShapes}
          penColor={penColor}
          penWidth={penWidth}
          saveState={saveState}
          canFormatText={Boolean(activeTextBlockId)}
          canUndo={canUndo}
          canRedo={canRedo}
          onToolChange={handleToolChange}
          onPenToolChange={setPenTool}
          onFillShapesChange={setFillShapes}
          onPenColorChange={setPenColor}
          onPenWidthChange={setPenWidth}
          onFormat={handleFormat}
          onUndo={handleUndo}
          onRedo={handleRedo}
        />

        {currentNote ? (
          <BoardEditor
            key={`${currentNote.id}-${tool === 'export' ? 'export' : 'edit'}`}
            note={currentNote}
            tool={tool}
            penTool={penTool}
            fillShapes={fillShapes}
            penColor={penColor}
            penWidth={penWidth}
            activeTextBlockId={activeTextBlockId}
            onActiveTextBlockChange={setActiveTextBlockId}
            onNoteChange={handleCurrentNoteChange}
          />
        ) : (
          <div className="empty-editor-state">
            <p>先新建一条笔记，再开始输入、手绘或区域导出。</p>
            <button className="secondary-button" type="button" onClick={handleCreateNote}>
              新建第一条笔记
            </button>
          </div>
        )}
      </section>

      {settingsOpen && library ? (
        <SettingsPanel
          settings={settings}
          library={library}
          dataPath={dataPath}
          onChange={handleSettingsChange}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </main>
  )
}

export default App
