import { useState } from 'react'
import clsx from 'clsx'
import {
  Folder,
  FolderPlus,
  NotebookPen,
  PencilLine,
  Trash2,
} from 'lucide-react'
import type { FolderRecord, NoteRecord } from '../../shared/model'

interface SidebarProps {
  folders: FolderRecord[]
  notes: NoteRecord[]
  selectedFolderId: string | null
  selectedNoteId: string | null
  onSelectFolder: (folderId: string) => void
  onCreateFolder: () => void
  onRenameFolder: (folderId: string, name: string) => void
  onDeleteFolder: (folderId: string) => void
  onCreateNote: () => void
  onSelectNote: (noteId: string) => void
  onDeleteNote: (noteId: string) => void
}

function formatRelativeTime(isoTime: string) {
  const deltaMinutes = Math.round((new Date(isoTime).getTime() - Date.now()) / 60000)
  const formatter = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' })

  if (Math.abs(deltaMinutes) < 60) {
    return formatter.format(deltaMinutes, 'minute')
  }

  const deltaHours = Math.round(deltaMinutes / 60)
  if (Math.abs(deltaHours) < 24) {
    return formatter.format(deltaHours, 'hour')
  }

  const deltaDays = Math.round(deltaHours / 24)
  return formatter.format(deltaDays, 'day')
}

export function Sidebar({
  folders,
  notes,
  selectedFolderId,
  selectedNoteId,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onCreateNote,
  onSelectNote,
  onDeleteNote,
}: SidebarProps) {
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const visibleNotes = notes.filter((note) => note.folderId === selectedFolderId)

  function startRename(folder: FolderRecord) {
    setRenamingFolderId(folder.id)
    setRenameDraft(folder.name)
  }

  function finishRename(folderId: string) {
    const nextName = renameDraft.trim()
    if (nextName) {
      onRenameFolder(folderId, nextName)
    }

    setRenamingFolderId(null)
    setRenameDraft('')
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>NoteCanvas</h1>
        </div>
        <p className="sidebar-subtitle">像便签一样快，像白板一样自由。</p>
      </div>

      <section className="sidebar-section">
        <div className="section-title-row">
          <h2>文件夹</h2>
          <button className="icon-button" type="button" onClick={onCreateFolder} aria-label="新建文件夹">
            <FolderPlus size={16} />
          </button>
        </div>

        <div className="sidebar-list">
          {folders.map((folder) => {
            const isActive = folder.id === selectedFolderId
            const count = notes.filter((note) => note.folderId === folder.id).length

            return (
              <div key={folder.id} className={clsx('sidebar-row', isActive && 'active')}>
                {renamingFolderId === folder.id ? (
                  <form
                    className="folder-rename-form"
                    onSubmit={(event) => {
                      event.preventDefault()
                      finishRename(folder.id)
                    }}
                  >
                    <Folder size={16} />
                    <input
                      value={renameDraft}
                      autoFocus
                      onBlur={() => finishRename(folder.id)}
                      onChange={(event) => setRenameDraft(event.target.value)}
                      onFocus={(event) => event.currentTarget.select()}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          setRenamingFolderId(null)
                          setRenameDraft('')
                        }
                      }}
                    />
                  </form>
                ) : (
                  <button
                    className="sidebar-main-button"
                    type="button"
                    onClick={() => onSelectFolder(folder.id)}
                  >
                    <span className="sidebar-row-title">
                      <Folder size={16} />
                      <span>{folder.name}</span>
                    </span>
                    <span className="sidebar-row-meta">{count}</span>
                  </button>
                )}

                {isActive ? (
                  <div className="sidebar-row-actions">
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => startRename(folder)}
                      aria-label="重命名文件夹"
                    >
                      <PencilLine size={15} />
                    </button>
                    <button
                      className="icon-button danger"
                      type="button"
                      onClick={() => onDeleteFolder(folder.id)}
                      aria-label="删除文件夹"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>

      <section className="sidebar-section grow">
        <div className="section-title-row">
          <h2>笔记</h2>
          <button className="icon-button" type="button" onClick={onCreateNote} aria-label="新建笔记">
            <NotebookPen size={16} />
          </button>
        </div>

        <div className="sidebar-list note-list">
          {visibleNotes.length > 0 ? (
            visibleNotes.map((note) => {
              const isActive = note.id === selectedNoteId

              return (
                <div key={note.id} className={clsx('note-card', isActive && 'active')}>
                  <button
                    className="note-card-main"
                    type="button"
                    onClick={() => onSelectNote(note.id)}
                  >
                    <span className="note-card-title">{note.title}</span>
                    <span className="note-card-meta">{formatRelativeTime(note.updatedAt)}</span>
                  </button>

                  <button
                    className="icon-button danger"
                    type="button"
                    onClick={() => onDeleteNote(note.id)}
                    aria-label="删除笔记"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )
            })
          ) : (
            <div className="empty-sidebar-state">
              <p>这个文件夹还没有笔记。</p>
              <button className="secondary-button" type="button" onClick={onCreateNote}>
                立即新建
              </button>
            </div>
          )}
        </div>
      </section>
    </aside>
  )
}
