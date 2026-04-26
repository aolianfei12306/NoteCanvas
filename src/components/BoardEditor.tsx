import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { Copy, Download, LoaderCircle, Plus } from 'lucide-react'
import {
  clampExportRect,
  createBoardPage,
  createTextBlock,
  getActivePage,
  touchNote,
  type BoardPageRecord,
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

interface BoardSelection extends ExportRect {
  pageId: string
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

function clampZoom(value: number) {
  return Math.max(0.4, Math.min(value, 2.5))
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
  const stageRef = useRef<HTMLDivElement | null>(null)
  const pageRefs = useRef(new Map<string, HTMLDivElement>())
  const draftPointsRef = useRef<Point[]>([])
  const pointerModeRef = useRef<'draw' | 'erase' | 'select' | null>(null)
  const pointerPageIdRef = useRef<string | null>(null)
  const selectionOriginRef = useRef<{ pageId: string; point: Point } | null>(null)
  const exportCacheRef = useRef<{ key: string; dataUrl: string } | null>(null)

  const [draftPoints, setDraftPoints] = useState<Point[]>([])
  const [selection, setSelection] = useState<BoardSelection | null>(null)
  const [dragPath, setDragPath] = useState<string | null>(null)
  const [dragLoading, setDragLoading] = useState(false)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [exportBusy, setExportBusy] = useState<'copy' | 'save' | null>(null)
  const [zoom, setZoom] = useState(1)

  const pages = note.document.pages
  const activePage = getActivePage(note.document)
  const canEditText = tool === 'browse' || tool === 'text'

  const selectionKey = useMemo(() => {
    if (!selection) {
      return null
    }

    return `${selection.pageId}-${selection.x}-${selection.y}-${selection.width}-${selection.height}-${note.revision}`
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

  function updatePage(
    pageId: string,
    updater: (page: BoardPageRecord) => BoardPageRecord,
  ) {
    updateDocument((document) => ({
      ...document,
      activePageId: pageId,
      pages: document.pages.map((page) =>
        page.id === pageId
          ? {
              ...updater(page),
              updatedAt: new Date().toISOString(),
            }
          : page,
      ),
    }))
  }

  function setActivePage(pageId: string) {
    if (pageId === note.document.activePageId) {
      return
    }

    updateDocument((document) => ({
      ...document,
      activePageId: pageId,
    }))
  }

  function addPage() {
    const page = createBoardPage()

    updateDocument((document) => ({
      ...document,
      pages: [...document.pages, page],
      activePageId: page.id,
    }))
    onActiveTextBlockChange(null)
    setSelection(null)
  }

  function getBoardPoint(event: React.PointerEvent | PointerEvent, page: BoardPageRecord): Point | null {
    const pageElement = pageRefs.current.get(page.id)
    if (!pageElement) {
      return null
    }

    const bounds = pageElement.getBoundingClientRect()
    const scaleX = page.width / bounds.width
    const scaleY = page.height / bounds.height
    const x = (event.clientX - bounds.left) * scaleX
    const y = (event.clientY - bounds.top) * scaleY

    return {
      x: Math.max(0, Math.min(x, page.width)),
      y: Math.max(0, Math.min(y, page.height)),
    }
  }

  function handleStageWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey || !stageRef.current) {
      return
    }

    event.preventDefault()

    const stage = stageRef.current
    const bounds = stage.getBoundingClientRect()
    const anchorX = event.clientX - bounds.left
    const anchorY = event.clientY - bounds.top
    const scrollAnchorX = stage.scrollLeft + anchorX
    const scrollAnchorY = stage.scrollTop + anchorY

    setZoom((currentZoom) => {
      const nextZoom = clampZoom(currentZoom * Math.exp(-event.deltaY * 0.0015))

      if (nextZoom === currentZoom) {
        return currentZoom
      }

      const boardAnchorX = scrollAnchorX / currentZoom
      const boardAnchorY = scrollAnchorY / currentZoom

      window.requestAnimationFrame(() => {
        stage.scrollLeft = boardAnchorX * nextZoom - anchorX
        stage.scrollTop = boardAnchorY * nextZoom - anchorY
      })

      return nextZoom
    })
  }

  function removeTextBlock(blockId: string) {
    updateDocument((document) => ({
      ...document,
      pages: document.pages.map((page) => ({
        ...page,
        textBlocks: page.textBlocks.filter((block) => block.id !== blockId),
      })),
    }))

    if (activeTextBlockId === blockId) {
      onActiveTextBlockChange(null)
    }
  }

  function eraseAt(page: BoardPageRecord, point: Point) {
    if (!page.strokes.some((stroke) => hitStroke(point, stroke))) {
      return
    }

    updatePage(page.id, (currentPage) => ({
      ...currentPage,
      strokes: currentPage.strokes.filter((stroke) => !hitStroke(point, stroke)),
    }))
  }

  function handleBoardPointerDown(event: React.PointerEvent<HTMLDivElement>, page: BoardPageRecord) {
    setActivePage(page.id)

    if (tool === 'text') {
      if (event.target !== event.currentTarget) {
        return
      }

      const point = getBoardPoint(event, page)
      if (!point) {
        return
      }

      const block = createTextBlock({
        x: point.x,
        y: point.y,
        width: 420,
        height: 180,
        html: '<p>?????</p>',
      })

      updatePage(page.id, (currentPage) => ({
        ...currentPage,
        textBlocks: [...currentPage.textBlocks, block],
      }))
      onActiveTextBlockChange(block.id)
      return
    }

    if (tool === 'browse') {
      onActiveTextBlockChange(null)
    }
  }

  function handleOverlayPointerDown(event: React.PointerEvent<SVGSVGElement>, page: BoardPageRecord) {
    const point = getBoardPoint(event, page)
    if (!point) {
      return
    }

    setActivePage(page.id)
    pointerPageIdRef.current = page.id

    if (tool === 'pen') {
      pointerModeRef.current = 'draw'
      draftPointsRef.current = [point]
      setDraftPoints([point])
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }

    if (tool === 'eraser') {
      pointerModeRef.current = 'erase'
      eraseAt(page, point)
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }

    if (tool === 'export') {
      pointerModeRef.current = 'select'
      selectionOriginRef.current = { pageId: page.id, point }
      setSelection({
        pageId: page.id,
        x: point.x,
        y: point.y,
        width: 1,
        height: 1,
      })
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }

  function handleOverlayPointerMove(event: React.PointerEvent<SVGSVGElement>, page: BoardPageRecord) {
    const point = getBoardPoint(event, page)
    if (!point || !pointerModeRef.current || pointerPageIdRef.current !== page.id) {
      return
    }

    if (pointerModeRef.current === 'draw') {
      draftPointsRef.current = [...draftPointsRef.current, point]
      setDraftPoints([...draftPointsRef.current])
      return
    }

    if (pointerModeRef.current === 'erase') {
      eraseAt(page, point)
      return
    }

    if (pointerModeRef.current === 'select' && selectionOriginRef.current?.pageId === page.id) {
      const origin = selectionOriginRef.current.point
      setSelection({
        pageId: page.id,
        ...clampExportRect(
          {
            x: Math.min(origin.x, point.x),
            y: Math.min(origin.y, point.y),
            width: Math.abs(point.x - origin.x),
            height: Math.abs(point.y - origin.y),
          },
          page.width,
          page.height,
        ),
      })
    }
  }

  function handleOverlayPointerUp() {
    const page = pages.find((candidate) => candidate.id === pointerPageIdRef.current)

    if (page && pointerModeRef.current === 'draw' && draftPointsRef.current.length > 1) {
      const nextStroke = buildStroke(draftPointsRef.current, penColor, penWidth)
      updatePage(page.id, (currentPage) => ({
        ...currentPage,
        strokes: [...currentPage.strokes, nextStroke],
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
    pointerPageIdRef.current = null
    setDraftPoints([])
  }

  async function getSelectionDataUrl() {
    if (!selection || !selectionKey) {
      throw new Error('??????????')
    }

    const pageElement = pageRefs.current.get(selection.pageId)
    if (!pageElement) {
      throw new Error('???????')
    }

    if (exportCacheRef.current?.key === selectionKey) {
      return exportCacheRef.current.dataUrl
    }

    const dataUrl = await captureSelection(pageElement, selection)
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
        const pageElement = pageRefs.current.get(activeSelection.pageId)
        if (!pageElement) {
          throw new Error('???????')
        }

        const dataUrl =
          exportCacheRef.current?.key === currentSelectionKey
            ? exportCacheRef.current.dataUrl
            : await captureSelection(pageElement, activeSelection)

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
          setExportMessage(error instanceof Error ? error.message : '???????')
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
      setExportMessage('??? PNG ????')
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : '????')
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
        setExportMessage(`???? ${result}`)
      }
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : '????')
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
      <div className="board-page-controls" data-export-ignore="true">
        <span>? {pages.length} ?</span>
        <button className="secondary-button" type="button" onClick={addPage}>
          <Plus size={14} />
          <span>??</span>
        </button>
      </div>

      <div ref={stageRef} className="board-stage" onWheel={handleStageWheel}>
        <div className="board-pages">
          {pages.map((page, pageIndex) => {
            const isActivePage = page.id === activePage.id

            return (
              <section key={page.id} className={clsx('board-page-shell', isActivePage && 'active')}>
                <div className="board-page-meta" data-export-ignore="true">
                  <button type="button" onClick={() => setActivePage(page.id)}>
                    ? {pageIndex + 1} ?
                  </button>
                  <span>{page.width} ? {page.height}</span>
                </div>

                <div
                  className="board-zoom-frame"
                  style={{
                    width: page.width * zoom,
                    height: page.height * zoom,
                  }}
                >
                  <div
                    ref={(node) => {
                      if (node) {
                        pageRefs.current.set(page.id, node)
                      } else {
                        pageRefs.current.delete(page.id)
                      }
                    }}
                    className={clsx('board-surface', tool === 'export' && 'selection-mode')}
                    style={{
                      width: page.width,
                      height: page.height,
                      transform: `scale(${zoom})`,
                    }}
                    onPointerDown={(event) => handleBoardPointerDown(event, page)}
                  >
                    <div className="paper-overlay" data-export-ignore="true" />

                    <svg
                      className={clsx('ink-layer', (tool === 'pen' || tool === 'eraser' || tool === 'export') && 'active')}
                      width={page.width}
                      height={page.height}
                      onPointerDown={(event) => handleOverlayPointerDown(event, page)}
                      onPointerMove={(event) => handleOverlayPointerMove(event, page)}
                      onPointerUp={handleOverlayPointerUp}
                      onPointerLeave={handleOverlayPointerUp}
                    >
                      {page.strokes.map((stroke) => (
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

                      {isActivePage && draftPoints.length > 0 ? (
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

                    {page.textBlocks.map((block) => (
                      <RichTextBlock
                        key={block.id}
                        block={block}
                        active={activeTextBlockId === block.id}
                        interactive={canEditText && isActivePage}
                        onActivate={(blockId) => {
                          setActivePage(page.id)
                          onActiveTextBlockChange(blockId)
                        }}
                        onChange={(nextBlock) =>
                          updatePage(page.id, (currentPage) => ({
                            ...currentPage,
                            textBlocks: currentPage.textBlocks.map((candidate) =>
                              candidate.id === nextBlock.id ? nextBlock : candidate,
                            ),
                          }))
                        }
                        onRemove={removeTextBlock}
                      />
                    ))}

                    {selection?.pageId === page.id ? (
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

                    {selection?.pageId === page.id ? (
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
                              <span>?????</span>
                            </>
                          ) : (
                            <span>?? PNG</span>
                          )}
                        </div>

                        <button className="secondary-button" type="button" onClick={handleCopy}>
                          <Copy size={14} />
                          <span>{exportBusy === 'copy' ? '????' : '??'}</span>
                        </button>
                        <button className="secondary-button" type="button" onClick={handleSave}>
                          <Download size={14} />
                          <span>{exportBusy === 'save' ? '????' : '?? PNG'}</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>
            )
          })}
        </div>
      </div>

      <div className="editor-statusbar">
        <span>{tool === 'export' ? '?????? / ??????????? PNG' : '???????????????'}</span>
        <span>{exportMessage ?? `??? ${activePage.width} ? ${activePage.height} ? ?? ${Math.round(zoom * 100)}%`}</span>
      </div>
    </div>
  )
}
