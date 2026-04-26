import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
  Plus,
  Unlock,
} from 'lucide-react'
import {
  clampExportRect,
  createBoardPage,
  createLayer,
  createTextBlock,
  getActiveLayer,
  getActivePage,
  touchNote,
  type BoardPageRecord,
  type ExportRect,
  type NoteRecord,
  type PenToolMode,
  type Point,
  type ShapeRecord,
  type StrokeRecord,
  type ToolMode,
} from '../../shared/model'
import { captureSelection, makeExportName } from '../lib/exportSelection'
import { RichTextBlock } from './RichTextBlock'

interface BoardEditorProps {
  note: NoteRecord
  tool: ToolMode
  penTool: PenToolMode
  fillShapes: boolean
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

function buildStroke(points: Point[], color: string, width: number, layerId: string): StrokeRecord {
  return {
    id: `stroke_${crypto.randomUUID()}`,
    layerId,
    color,
    width,
    opacity: 1,
    points,
    createdAt: new Date().toISOString(),
  }
}

function buildShape(
  origin: Point,
  point: Point,
  kind: Exclude<PenToolMode, 'freehand'>,
  color: string,
  width: number,
  fillShapes: boolean,
  layerId: string,
): ShapeRecord {
  const isLine = kind === 'line'

  return {
    id: `shape_${crypto.randomUUID()}`,
    layerId,
    kind,
    x: isLine ? origin.x : Math.min(origin.x, point.x),
    y: isLine ? origin.y : Math.min(origin.y, point.y),
    width: isLine ? point.x - origin.x : Math.abs(point.x - origin.x),
    height: isLine ? point.y - origin.y : Math.abs(point.y - origin.y),
    strokeColor: color,
    strokeWidth: width,
    strokeOpacity: 1,
    fillColor: fillShapes && !isLine ? color : null,
    fillOpacity: 0.18,
    createdAt: new Date().toISOString(),
  }
}

function hitStroke(point: Point, stroke: StrokeRecord) {
  return stroke.points.some((candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) <= stroke.width + 10)
}

function hitShape(point: Point, shape: ShapeRecord) {
  if (shape.kind === 'line') {
    const start = { x: shape.x, y: shape.y }
    const end = { x: shape.x + shape.width, y: shape.y + shape.height }
    const lengthSquared = Math.hypot(end.x - start.x, end.y - start.y) ** 2
    const ratio = lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) / lengthSquared))
    const projection = {
      x: start.x + (end.x - start.x) * ratio,
      y: start.y + (end.y - start.y) * ratio,
    }

    return Math.hypot(point.x - projection.x, point.y - projection.y) <= shape.strokeWidth + 8
  }

  return point.x >= shape.x && point.x <= shape.x + shape.width && point.y >= shape.y && point.y <= shape.y + shape.height
}

function clampZoom(value: number) {
  return Math.max(0.4, Math.min(value, 2.5))
}

function canEditLayer(page: BoardPageRecord) {
  const layer = getActiveLayer(page)
  return Boolean(layer?.visible && !layer.locked)
}

function renderShape(shape: ShapeRecord) {
  if (shape.kind === 'line') {
    return (
      <line
        key={shape.id}
        x1={shape.x}
        y1={shape.y}
        x2={shape.x + shape.width}
        y2={shape.y + shape.height}
        stroke={shape.strokeColor}
        strokeWidth={shape.strokeWidth}
        strokeOpacity={shape.strokeOpacity}
        strokeLinecap="round"
      />
    )
  }

  if (shape.kind === 'ellipse') {
    return (
      <ellipse
        key={shape.id}
        cx={shape.x + shape.width / 2}
        cy={shape.y + shape.height / 2}
        rx={Math.max(1, shape.width / 2)}
        ry={Math.max(1, shape.height / 2)}
        fill={shape.fillColor ?? 'none'}
        fillOpacity={shape.fillColor ? shape.fillOpacity : 0}
        stroke={shape.strokeColor}
        strokeWidth={shape.strokeWidth}
        strokeOpacity={shape.strokeOpacity}
      />
    )
  }

  return (
    <rect
      key={shape.id}
      x={shape.x}
      y={shape.y}
      width={Math.max(1, shape.width)}
      height={Math.max(1, shape.height)}
      fill={shape.fillColor ?? 'none'}
      fillOpacity={shape.fillColor ? shape.fillOpacity : 0}
      stroke={shape.strokeColor}
      strokeWidth={shape.strokeWidth}
      strokeOpacity={shape.strokeOpacity}
      rx={10}
    />
  )
}

export function BoardEditor({
  note,
  tool,
  penTool,
  fillShapes,
  penColor,
  penWidth,
  activeTextBlockId,
  onActiveTextBlockChange,
  onNoteChange,
}: BoardEditorProps) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const pageRefs = useRef(new Map<string, HTMLDivElement>())
  const draftPointsRef = useRef<Point[]>([])
  const pointerModeRef = useRef<'draw' | 'shape' | 'erase' | 'select' | null>(null)
  const pointerPageIdRef = useRef<string | null>(null)
  const shapeOriginRef = useRef<Point | null>(null)
  const selectionOriginRef = useRef<{ pageId: string; point: Point } | null>(null)
  const exportCacheRef = useRef<{ key: string; dataUrl: string } | null>(null)

  const [draftPoints, setDraftPoints] = useState<Point[]>([])
  const [draftShape, setDraftShape] = useState<ShapeRecord | null>(null)
  const [selection, setSelection] = useState<BoardSelection | null>(null)
  const [dragPath, setDragPath] = useState<string | null>(null)
  const [dragLoading, setDragLoading] = useState(false)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [exportBusy, setExportBusy] = useState<'copy' | 'save' | null>(null)
  const [zoom, setZoom] = useState(1)

  const pages = note.document.pages
  const activePage = getActivePage(note.document)
  const activeLayer = getActiveLayer(activePage)
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

  function addLayer() {
    const layer = createLayer(`?? ${activePage.layers.length + 1}`)

    updatePage(activePage.id, (page) => ({
      ...page,
      layers: [...page.layers, layer],
      activeLayerId: layer.id,
    }))
    onActiveTextBlockChange(null)
  }

  function selectLayer(layerId: string) {
    updatePage(activePage.id, (page) => ({
      ...page,
      activeLayerId: layerId,
    }))
    onActiveTextBlockChange(null)
  }

  function renameLayer(layerId: string) {
    const currentLayer = activePage.layers.find((layer) => layer.id === layerId)
    if (!currentLayer) {
      return
    }

    const nextName = window.prompt('?????', currentLayer.name)?.trim()
    if (!nextName) {
      return
    }

    updatePage(activePage.id, (page) => ({
      ...page,
      layers: page.layers.map((layer) =>
        layer.id === layerId
          ? {
              ...layer,
              name: nextName,
              updatedAt: new Date().toISOString(),
            }
          : layer,
      ),
    }))
  }

  function toggleLayerVisibility(layerId: string) {
    updatePage(activePage.id, (page) => ({
      ...page,
      layers: page.layers.map((layer) =>
        layer.id === layerId
          ? {
              ...layer,
              visible: !layer.visible,
              updatedAt: new Date().toISOString(),
            }
          : layer,
      ),
    }))
  }

  function toggleLayerLock(layerId: string) {
    updatePage(activePage.id, (page) => ({
      ...page,
      layers: page.layers.map((layer) =>
        layer.id === layerId
          ? {
              ...layer,
              locked: !layer.locked,
              updatedAt: new Date().toISOString(),
            }
          : layer,
      ),
    }))
  }

  function moveLayer(layerId: string, direction: -1 | 1) {
    updatePage(activePage.id, (page) => {
      const currentIndex = page.layers.findIndex((layer) => layer.id === layerId)
      const nextIndex = currentIndex + direction

      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= page.layers.length) {
        return page
      }

      const layers = [...page.layers]
      const [layer] = layers.splice(currentIndex, 1)
      layers.splice(nextIndex, 0, layer)

      return {
        ...page,
        layers,
      }
    })
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
    if (!canEditLayer(page)) {
      setExportMessage('??????????')
      return
    }

    const hitsStroke = page.strokes.some((stroke) => stroke.layerId === page.activeLayerId && hitStroke(point, stroke))
    const hitsShape = page.shapes.some((shape) => shape.layerId === page.activeLayerId && hitShape(point, shape))

    if (!hitsStroke && !hitsShape) {
      return
    }

    updatePage(page.id, (currentPage) => ({
      ...currentPage,
      strokes: currentPage.strokes.filter((stroke) => stroke.layerId !== page.activeLayerId || !hitStroke(point, stroke)),
      shapes: currentPage.shapes.filter((shape) => shape.layerId !== page.activeLayerId || !hitShape(point, shape)),
    }))
  }

  function handleBoardPointerDown(event: React.PointerEvent<HTMLDivElement>, page: BoardPageRecord) {
    setActivePage(page.id)

    if (tool === 'text') {
      if (event.target !== event.currentTarget) {
        return
      }

      if (!canEditLayer(page)) {
        setExportMessage('??????????')
        return
      }

      const point = getBoardPoint(event, page)
      if (!point) {
        return
      }

      const block = createTextBlock({
        layerId: page.activeLayerId,
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
      if (!canEditLayer(page)) {
        setExportMessage('??????????')
        return
      }

      if (penTool !== 'freehand') {
        pointerModeRef.current = 'shape'
        shapeOriginRef.current = point
        setDraftShape(buildShape(point, point, penTool, penColor, penWidth, fillShapes, page.activeLayerId))
        event.currentTarget.setPointerCapture(event.pointerId)
        return
      }

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

    if (pointerModeRef.current === 'shape' && shapeOriginRef.current && penTool !== 'freehand') {
      setDraftShape(buildShape(shapeOriginRef.current, point, penTool, penColor, penWidth, fillShapes, page.activeLayerId))
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
      const nextStroke = buildStroke(draftPointsRef.current, penColor, penWidth, page.activeLayerId)
      updatePage(page.id, (currentPage) => ({
        ...currentPage,
        strokes: [...currentPage.strokes, nextStroke],
      }))
    }

    if (page && pointerModeRef.current === 'shape' && draftShape && Math.hypot(draftShape.width, draftShape.height) > 4) {
      updatePage(page.id, (currentPage) => ({
        ...currentPage,
        shapes: [...currentPage.shapes, draftShape],
      }))
    }

    if (pointerModeRef.current === 'select' && selection) {
      if (selection.width < 24 || selection.height < 24) {
        setSelection(null)
      }
    }

    draftPointsRef.current = []
    shapeOriginRef.current = null
    selectionOriginRef.current = null
    pointerModeRef.current = null
    pointerPageIdRef.current = null
    setDraftPoints([])
    setDraftShape(null)
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
        <div className="page-actions">
          <span>? {pages.length} ?</span>
          <button className="secondary-button" type="button" onClick={addPage}>
            <Plus size={14} />
            <span>??</span>
          </button>
        </div>

        <div className="layer-panel">
          <div className="layer-panel-header">
            <span>???{activeLayer?.name}</span>
            <button className="icon-button subtle" type="button" onClick={addLayer} aria-label="????">
              <Plus size={14} />
            </button>
          </div>
          <div className="layer-list">
            {activePage.layers.map((layer, layerIndex) => {
              const isActiveLayer = layer.id === activePage.activeLayerId

              return (
                <div key={layer.id} className={clsx('layer-row', isActiveLayer && 'active')}>
                  <button
                    className="layer-main-button"
                    type="button"
                    onClick={() => selectLayer(layer.id)}
                    onDoubleClick={() => renameLayer(layer.id)}
                    title="???????"
                  >
                    {layer.name}
                  </button>
                  <button className="icon-button subtle" type="button" onClick={() => toggleLayerVisibility(layer.id)} aria-label="??????">
                    {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button className="icon-button subtle" type="button" onClick={() => toggleLayerLock(layer.id)} aria-label="??????">
                    {layer.locked ? <Lock size={14} /> : <Unlock size={14} />}
                  </button>
                  <button className="icon-button subtle" type="button" onClick={() => moveLayer(layer.id, 1)} disabled={layerIndex === activePage.layers.length - 1} aria-label="????">
                    <ArrowUp size={14} />
                  </button>
                  <button className="icon-button subtle" type="button" onClick={() => moveLayer(layer.id, -1)} disabled={layerIndex === 0} aria-label="????">
                    <ArrowDown size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div ref={stageRef} className="board-stage" onWheel={handleStageWheel}>
        <div className="board-pages">
          {pages.map((page, pageIndex) => {
            const isActivePage = page.id === activePage.id
            const visibleLayerIds = new Set(page.layers.filter((layer) => layer.visible).map((layer) => layer.id))
            const pageCanEditLayer = canEditLayer(page)

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
                      {page.layers.filter((layer) => layer.visible).flatMap((layer) => [
                        ...page.shapes.filter((shape) => shape.layerId === layer.id).map(renderShape),
                        ...page.strokes.filter((stroke) => stroke.layerId === layer.id).map((stroke) => (
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
                        )),
                      ])}

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

                      {isActivePage && draftShape ? renderShape(draftShape) : null}
                    </svg>

                    {page.textBlocks.filter((block) => visibleLayerIds.has(block.layerId)).map((block) => (
                      <RichTextBlock
                        key={block.id}
                        block={block}
                        active={activeTextBlockId === block.id}
                        interactive={canEditText && isActivePage && pageCanEditLayer && block.layerId === page.activeLayerId}
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
