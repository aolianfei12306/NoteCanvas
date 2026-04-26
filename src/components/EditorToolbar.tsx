import clsx from 'clsx'
import {
  Bold,
  Circle,
  Crop,
  Eraser,
  Italic,
  List,
  Minus,
  MousePointer2,
  PaintBucket,
  Palette,
  Pencil,
  Redo2,
  Square,
  Type,
  Undo2,
} from 'lucide-react'
import type { PenToolMode, ToolMode } from '../../shared/model'
import type { TextFormatCommand } from '../lib/textFormat'

interface EditorToolbarProps {
  tool: ToolMode
  penTool: PenToolMode
  fillShapes: boolean
  penColor: string
  penWidth: number
  penOpacity: number
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  canFormatText: boolean
  canUndo: boolean
  canRedo: boolean
  onToolChange: (tool: ToolMode) => void
  onPenToolChange: (tool: PenToolMode) => void
  onFillShapesChange: (fill: boolean) => void
  onPenColorChange: (color: string) => void
  onPenWidthChange: (width: number) => void
  onPenOpacityChange: (opacity: number) => void
  onFormat: (command: TextFormatCommand) => void
  onUndo: () => void
  onRedo: () => void
}

const COLORS = [
  '#111827',
  '#6b7280',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
]

const PEN_TOOL_ITEMS: Array<{
  key: PenToolMode
  label: string
  icon: typeof Pencil
}> = [
  { key: 'freehand', label: '自由', icon: Pencil },
  { key: 'line', label: '直线', icon: Minus },
  { key: 'rectangle', label: '矩形', icon: Square },
  { key: 'ellipse', label: '椭圆', icon: Circle },
]

const TOOL_ITEMS: Array<{
  key: ToolMode
  label: string
  icon: typeof MousePointer2
}> = [
  { key: 'browse', label: '移动', icon: MousePointer2 },
  { key: 'text', label: '文本', icon: Type },
  { key: 'pen', label: '画笔', icon: Pencil },
  { key: 'eraser', label: '橡皮', icon: Eraser },
  { key: 'export', label: '框选导出', icon: Crop },
]

function saveLabel(state: EditorToolbarProps['saveState']) {
  switch (state) {
    case 'saving':
      return '正在保存…'
    case 'saved':
      return '已自动保存'
    case 'error':
      return '保存失败'
    default:
      return '本地离线库'
  }
}

export function EditorToolbar({
  tool,
  penTool,
  fillShapes,
  penColor,
  penWidth,
  penOpacity,
  saveState,
  canFormatText,
  canUndo,
  canRedo,
  onToolChange,
  onPenToolChange,
  onFillShapesChange,
  onPenColorChange,
  onPenWidthChange,
  onPenOpacityChange,
  onFormat,
  onUndo,
  onRedo,
}: EditorToolbarProps) {
  return (
    <div className="editor-toolbar">
      <div className="toolbar-group">
        {TOOL_ITEMS.map((item) => {
          const Icon = item.icon

          return (
            <button
              key={item.key}
              className={clsx('tool-button', tool === item.key && 'active')}
              type="button"
              onClick={() => onToolChange(item.key)}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>

      {tool === 'pen' ? (
        <div className="toolbar-group compact">
          {PEN_TOOL_ITEMS.map((item) => {
            const Icon = item.icon

            return (
              <button
                key={item.key}
                className={clsx('tool-button', penTool === item.key && 'active')}
                type="button"
                onClick={() => onPenToolChange(item.key)}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            )
          })}
          <button
            className={clsx('tool-button', fillShapes && 'active')}
            type="button"
            onClick={() => onFillShapesChange(!fillShapes)}
          >
            <PaintBucket size={16} />
            <span>填充</span>
          </button>
          {COLORS.map((color) => (
            <button
              key={color}
              className={clsx('color-swatch', penColor === color && 'active')}
              type="button"
              style={{ backgroundColor: color }}
              onClick={() => onPenColorChange(color)}
              aria-label={`切换画笔颜色 ${color}`}
            />
          ))}
          <label className="custom-color-control" aria-label="自定义画笔颜色">
            <Palette size={16} />
            <input
              type="color"
              value={penColor}
              onChange={(event) => onPenColorChange(event.target.value)}
            />
          </label>
          <label className="range-control">
            <span>粗细</span>
            <input
              type="range"
              min="2"
              max="18"
              value={penWidth}
              onChange={(event) => onPenWidthChange(Number(event.target.value))}
            />
          </label>
          <label className="range-control">
            <span>透明</span>
            <input
              type="range"
              min="0.2"
              max="1"
              step="0.05"
              value={penOpacity}
              onChange={(event) => onPenOpacityChange(Number(event.target.value))}
            />
          </label>
        </div>
      ) : null}

      <div className="toolbar-group compact">
        <button className="icon-text-button" type="button" onClick={onUndo} disabled={!canUndo} aria-label="撤销">
          <Undo2 size={16} />
        </button>
        <button className="icon-text-button" type="button" onClick={onRedo} disabled={!canRedo} aria-label="重做">
          <Redo2 size={16} />
        </button>
      </div>

      <div className="toolbar-group compact">
        <button
          className="icon-text-button"
          type="button"
          onMouseDown={(event) => {
            event.preventDefault()
            onFormat('bold')
          }}
          disabled={!canFormatText}
        >
          <Bold size={16} />
        </button>
        <button
          className="icon-text-button"
          type="button"
          onMouseDown={(event) => {
            event.preventDefault()
            onFormat('italic')
          }}
          disabled={!canFormatText}
        >
          <Italic size={16} />
        </button>
        <button
          className="icon-text-button"
          type="button"
          onMouseDown={(event) => {
            event.preventDefault()
            onFormat('insertUnorderedList')
          }}
          disabled={!canFormatText}
        >
          <List size={16} />
        </button>
      </div>

      <div className={clsx('save-chip', saveState)}>{saveLabel(saveState)}</div>
    </div>
  )
}
