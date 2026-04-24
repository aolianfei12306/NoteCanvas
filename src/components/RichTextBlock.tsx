import { useEffect, useRef } from 'react'
import clsx from 'clsx'
import { GripVertical, X } from 'lucide-react'
import { Rnd } from 'react-rnd'
import type { TextBlockRecord } from '../../shared/model'

interface RichTextBlockProps {
  block: TextBlockRecord
  active: boolean
  interactive: boolean
  onActivate: (blockId: string) => void
  onChange: (block: TextBlockRecord) => void
  onRemove: (blockId: string) => void
}

export function RichTextBlock({
  block,
  active,
  interactive,
  onActivate,
  onChange,
  onRemove,
}: RichTextBlockProps) {
  const editorRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!editorRef.current) {
      return
    }

    if (document.activeElement !== editorRef.current && editorRef.current.innerHTML !== block.html) {
      editorRef.current.innerHTML = block.html
    }
  }, [block.html])

  return (
    <Rnd
      bounds="parent"
      className={clsx('text-block-shell', active && 'active', !interactive && 'readonly')}
      size={{ width: block.width, height: block.height }}
      position={{ x: block.x, y: block.y }}
      disableDragging={!interactive}
      enableResizing={interactive}
      dragHandleClassName="text-block-drag-handle"
      cancel=".text-block-editor,button"
      onDragStart={() => onActivate(block.id)}
      onDragStop={(_, data) =>
        onChange({
          ...block,
          x: data.x,
          y: data.y,
          updatedAt: new Date().toISOString(),
        })
      }
      onResizeStop={(_, __, ref, ___, position) =>
        onChange({
          ...block,
          x: position.x,
          y: position.y,
          width: ref.offsetWidth,
          height: ref.offsetHeight,
          updatedAt: new Date().toISOString(),
        })
      }
    >
      <div className="text-block-card" onMouseDown={() => onActivate(block.id)}>
        <div className="text-block-header" data-export-ignore="true">
          <div className="text-block-drag-handle">
            <GripVertical size={14} />
            <span>文本块</span>
          </div>
          <button
            className="icon-button subtle"
            data-export-ignore="true"
            type="button"
            onClick={() => onRemove(block.id)}
          >
            <X size={14} />
          </button>
        </div>

        <div
          ref={editorRef}
          className="text-block-editor"
          contentEditable={interactive}
          suppressContentEditableWarning
          onFocus={() => onActivate(block.id)}
          onMouseDown={(event) => event.stopPropagation()}
          onInput={(event) =>
            onChange({
              ...block,
              html: event.currentTarget.innerHTML,
              updatedAt: new Date().toISOString(),
            })
          }
        />
      </div>
    </Rnd>
  )
}
