import clsx from 'clsx'
import {
  Bold,
  Crop,
  Eraser,
  Italic,
  List,
  MousePointer2,
  Pencil,
  Type,
} from 'lucide-react'
import type { ToolMode } from '../../shared/model'
import type { TextFormatCommand } from '../lib/textFormat'

interface EditorToolbarProps {
  tool: ToolMode
  penColor: string
  penWidth: number
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  canFormatText: boolean
  onToolChange: (tool: ToolMode) => void
  onPenColorChange: (color: string) => void
  onPenWidthChange: (width: number) => void
  onFormat: (command: TextFormatCommand) => void
}

const COLORS = ['#111827', '#1d4ed8', '#9333ea', '#dc2626', '#059669']

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
  penColor,
  penWidth,
  saveState,
  canFormatText,
  onToolChange,
  onPenColorChange,
  onPenWidthChange,
  onFormat,
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

      <div className="toolbar-group compact">
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
