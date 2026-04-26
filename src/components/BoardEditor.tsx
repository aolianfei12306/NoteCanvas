import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { Copy, Download, LoaderCircle } from 'lucide-react'
import {
  clampExportRect,
  createTextBlock,
  touchNote,
  type ExportRect,
  type NoteRecord,
  type Point,
  type StrokeRecord,
  type ToolMode,
} from '../../shared/model'
import { captureSelection, makeExportName } from '../lib/exportSelection'
import { RichTextBlock } from './RichTextBlock'

interface BoardEditorProps {
  note: NoteRecord
  tool: ToolMode
  penColor: string
  penWidth: number
  activeTextBlockId: string | null
  onActiveTextBlockChange: (blockId: string | null) => void
  onNoteChange: (nextNote: NoteRecord) => void
}

function pointsToPath(points: Point[]) {
  if (points.length === 0) {
    return ''
  }

  return points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`
    }

    return `${path} L ${point.x} ${point.y}`
  }, '')
}

function buildStroke(points: Point[], color: string, width: number): StrokeRecord {
  return {
    id: `stroke_${crypto.randomUUID()}`,
    color,
    width,
    opacity: 1,
    points,
    createdAt: new Date().toISOString(),
  }
}

function hitStroke(point: Point, stroke: StrokeRecord) {
  return stroke.points.some((candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) <= stroke.width + 10)
}

export function BoardEditor({
  note,
  tool,
  penColor,
  penWidth,
  activeTextBlockId,
  onActiveTextBlockChange,
  onNoteChange,
}: BoardEditorProps) {
  const boardRef = useRef<HTMLDivElement | null>(null)
  const draftPointsRef = useRef<Point[]>([])
  const pointerModeRef = useRef<'draw' | 'erase' | 'select' | null>(null)
  const selectionOriginRef = useRef<Point | null>(null)
  const exportCacheRef = useRef<{ key: string; dataUrl: string } | null>(null)

  const [draftPoints, setDraftPoints] = useState<Point[]>([])
  const [selection, setSelection] = useState<ExportRect | null>(null)
  const [dragPath, setDragPath] = useState<string | null>(null)
  const [dragLoading, setDragLoading] = useState(false)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [exportBusy, setExportBusy] = useState<'copy' | 'save' | null>(null)

  const canEditText = tool === 'browse' || tool === 'text'

  const selectionKey = useMemo(() => {
    if (!selection) {
      return null
    }

    return `${selection.x}-${selection.y}-${selection.width}-${selection.height}-${note.revision}`
  }, [selection, note.revision])

  function commit(nextNote: NoteRecord) {
    exportCacheRef.current = null
    setDragPath(null)
    onNoteChange(nextNote)
  }

  function updateDocument(
    updater: (document: NoteRecord['document']) => NoteRecord['document'],
  ) {
    commit(
      touchNote(note, {
        document: updater(note.document),
      }),
    )
  }

  function getBoardPoint(event: React.PointerEvent | PointerEvent): Point | null {
    if (!boardRef.current) {
      return null
    }

    const bounds = boardRef.current.getBoundingClientRect()
    const x = event.clientX - bounds.left
    const y = event.clientY - bounds.top

    return {
      x: Math.max(0, Math.min(x, note.document.width)),
      y: Math.max(0, Math.min(y, note.document.height)),
    }
  }

  function removeTextBlock(blockId: string) {
    updateDocument((document) => ({
      ...document,
      textBlocks: document.textBlocks.filter((block) => block.id !== blockId),
    }))

    if (activeTextBlockId === blockId) {
      onActiveTextBlockChange(null)
    }
  }

  function eraseAt(point: Point) {
    if (!note.document.strokes.some((stroke) => hitStroke(point, stroke))) {
      return
    }

    updateDocument((document) => ({
      ...document,
      strokes: document.strokes.filter((stroke) => !hitStroke(point, stroke)),
    }))
  }

  function handleBoardPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (tool === 'text') {
      if (event.target !== event.currentTarget) {
        return
      }

      const point = getBoardPoint(event)
      if (!point) {
        return
      }

      const block = createTextBlock({
        x: point.x,
        y: point.y,
        width: 420,
        height: 180,
        html: '<p>输入文字…</p>',
      })

      updateDocument((document) => ({
        ...document,
        textBlocks: [...document.textBlocks, block],
      }))
      onActiveTextBlockChange(block.id)
      return
    }

    if (tool === 'browse') {
      onActiveTextBlockChange(null)
    }
  }

  function handleOverlayPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    const point = getBoardPoint(event)
    if (!point) {
      return
    }

    if (tool === 'pen') {
      pointerModeRef.current = 'draw'
      draftPointsRef.current = [point]
      setDraftPoints([point])
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }

    if (tool === 'eraser') {
      pointerModeRef.current = 'erase'
      eraseAt(point)
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }

    if (tool === 'export') {
      pointerModeRef.current = 'select'
      selectionOriginRef.current = point
      setSelection({
        x: point.x,
        y: point.y,
        width: 1,
        height: 1,
      })
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }

  function handleOverlayPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const point = getBoardPoint(event)
    if (!point || !pointerModeRef.current) {
      return
    }

    if (pointerModeRef.current === 'draw') {
      draftPointsRef.current = [...draftPointsRef.current, point]
      setDraftPoints([...draftPointsRef.current])
      return
    }

    if (pointerModeRef.current === 'erase') {
      eraseAt(point)
      return
    }

    if (pointerModeRef.current === 'select' && selectionOriginRef.current) {
      const origin = selectionOriginRef.current
      setSelection(
        clampExportRect(
          {
            x: Math.min(origin.x, point.x),
            y: Math.min(origin.y, point.y),
            width: Math.abs(point.x - origin.x),
            height: Math.abs(point.y - origin.y),
          },
          note.document.width,
          note.document.height,
        ),
      )
    }
  }

  function handleOverlayPointerUp() {
    if (pointerModeRef.current === 'draw' && draftPointsRef.current.length > 1) {
      const nextStroke = buildStroke(draftPointsRef.current, penColor, penWidth)
      updateDocument((document) => ({
        ...document,
        strokes: [...document.strokes, nextStroke],
      }))
    }

    if (pointerModeRef.current === 'select' && selection) {
      if (selection.width < 24 || selection.height < 24) {
        setSelection(null)
      }
    }

    draftPointsRef.current = []
    selectionOriginRef.current = null
    pointerModeRef.current = null
    setDraftPoints([])
  }

  async function getSelectionDataUrl() {
    if (!boardRef.current || !selection || !selectionKey) {
      throw new Error('当前没有可导出的区域')
    }

    if (exportCacheRef.current?.key === selectionKey) {
      return exportCacheRef.current.dataUrl
    }

    const dataUrl = await captureSelection(boardRef.current, selection)
    exportCacheRef.current = {
      key: selectionKey,
      dataUrl,
    }
    return dataUrl
  }

  useEffect(() => {
    if (!selection || !selectionKey) {
      return
    }

    const activeSelection = selection
    const currentSelectionKey = selectionKey
    let cancelled = false

    async function prepareDragImage() {
      try {
        setDragLoading(true)
        if (!boardRef.current) {
          throw new Error('画布尚未准备好')
        }

        const dataUrl =
          exportCacheRef.current?.key === currentSelectionKey
            ? exportCacheRef.current.dataUrl
            : await captureSelection(boardRef.current, activeSelection)

        exportCacheRef.current = {
          key: currentSelectionKey,
          dataUrl,
        }

        const filePath = await window.noteCanvas.stageDragImage(
          dataUrl,
          `${makeExportName(note.title)}-selection`,
        )

        if (!cancelled) {
          setDragPath(filePath)
        }
      } catch (error) {
        if (!cancelled) {
          setExportMessage(error instanceof Error ? error.message : '拖拽预处理失败')
        }
      } finally {
        if (!cancelled) {
          setDragLoading(false)
        }
      }
    }

    prepareDragImage()

    return () => {
      cancelled = true
    }
  }, [selection, selectionKey, note.title])

  async function handleCopy() {
    try {
      setExportBusy('copy')
      const dataUrl = await getSelectionDataUrl()
      await window.noteCanvas.copyImage(dataUrl)
      setExportMessage('已复制 PNG 到剪贴板')
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : '复制失败')
    } finally {
      setExportBusy(null)
    }
  }

  async function handleSave() {
    try {
      setExportBusy('save')
      const dataUrl = await getSelectionDataUrl()
      const result = await window.noteCanvas.saveImageAs(
        dataUrl,
        `${makeExportName(note.title)}-selection`,
      )
      if (result) {
        setExportMessage(`已导出到 ${result}`)
      }
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : '导出失败')
    } finally {
      setExportBusy(null)
    }
  }

  const toolbarStyle =
    selection && selection.y > 84
      ? {
          left: selection.x,
          top: Math.max(12, selection.y - 58),
        }
      : selection
        ? {
            left: selection.x,
            top: selection.y + selection.height + 12,
          }
        : undefined

  return (
    <div className="board-shell">
      <div className="board-stage">
        <div
          ref={boardRef}
          className={clsx('board-surface', tool === 'export' && 'selection-mode')}
          style={{
            width: note.document.width,
            height: note.document.height,
          }}
          onPointerDown={handleBoardPointerDown}
        >
          <div className="paper-overlay" data-export-ignore="true" />

          <svg
            className={clsx('ink-layer', (tool === 'pen' || tool === 'eraser' || tool === 'export') && 'active')}
            width={note.document.width}
            height={note.document.height}
            onPointerDown={handleOverlayPointerDown}
            onPointerMove={handleOverlayPointerMove}
            onPointerUp={handleOverlayPointerUp}
            onPointerLeave={handleOverlayPointerUp}
          >
            {note.document.strokes.map((stroke) => (
              <path
                key={stroke.id}
                d={pointsToPath(stroke.points)}
                fill="none"
                stroke={stroke.color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={stroke.width}
                strokeOpacity={stroke.opacity}
              />
            ))}

            {draftPoints.length > 0 ? (
              <path
                d={pointsToPath(draftPoints)}
                fill="none"
                stroke={penColor}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={penWidth}
              />
            ) : null}
          </svg>

          {note.document.textBlocks.map((block) => (
            <RichTextBlock
              key={block.id}
              block={block}
              active={activeTextBlockId === block.id}
              interactive={canEditText}
              onActivate={onActiveTextBlockChange}
              onChange={(nextBlock) =>
                updateDocument((document) => ({
                  ...document,
                  textBlocks: document.textBlocks.map((candidate) =>
                    candidate.id === nextBlock.id ? nextBlock : candidate,
                  ),
                }))
              }
              onRemove={removeTextBlock}
            />
          ))}

          {selection ? (
            <div
              className="selection-rect"
              data-export-ignore="true"
              style={{
                left: selection.x,
                top: selection.y,
                width: selection.width,
                height: selection.height,
              }}
            />
          ) : null}

          {selection ? (
            <div className="selection-toolbar" data-export-ignore="true" style={toolbarStyle}>
              <div
                className={clsx('drag-chip', dragLoading && 'loading')}
                draggable={Boolean(dragPath) && !dragLoading}
                onDragStart={(event) => {
                  if (!dragPath) {
                    event.preventDefault()
                    return
                  }

                  event.dataTransfer.setData('text/plain', note.title)
                  window.noteCanvas.startFileDrag(dragPath)
                }}
              >
                {dragLoading ? (
                  <>
                    <LoaderCircle size={14} className="spin" />
                    <span>准备拖拽…</span>
                  </>
                ) : (
                  <span>拖出 PNG</span>
                )}
              </div>

              <button className="secondary-button" type="button" onClick={handleCopy}>
                <Copy size={14} />
                <span>{exportBusy === 'copy' ? '复制中…' : '复制'}</span>
              </button>
              <button className="secondary-button" type="button" onClick={handleSave}>
                <Download size={14} />
                <span>{exportBusy === 'save' ? '导出中…' : '另存 PNG'}</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="editor-statusbar">
        <span>{tool === 'export' ? '拖拽到文件夹 / 网页上传区即可落为完整 PNG' : '本页支持文本块、手绘与区域导出'}</span>
        <span>{exportMessage ?? `画布尺寸 ${note.document.width} × ${note.document.height}`}</span>
      </div>
    </div>
  )
}
