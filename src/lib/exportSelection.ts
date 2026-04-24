import { toCanvas } from 'html-to-image'
import { clampExportRect, sanitizeFileName, type ExportRect } from '../../shared/model'

export async function captureSelection(node: HTMLElement, rect: ExportRect) {
  const bounded = clampExportRect(rect, node.clientWidth, node.clientHeight)
  const pixelRatio = Math.max(window.devicePixelRatio, 2)

  const fullCanvas = await toCanvas(node, {
    cacheBust: true,
    pixelRatio,
    backgroundColor: '#fffdf8',
    filter: (currentNode) =>
      !(currentNode instanceof HTMLElement && currentNode.dataset.exportIgnore === 'true'),
  })

  const output = document.createElement('canvas')
  output.width = Math.max(1, Math.round(bounded.width * pixelRatio))
  output.height = Math.max(1, Math.round(bounded.height * pixelRatio))

  const context = output.getContext('2d')
  if (!context) {
    throw new Error('无法创建导出画布')
  }

  context.drawImage(
    fullCanvas,
    bounded.x * pixelRatio,
    bounded.y * pixelRatio,
    bounded.width * pixelRatio,
    bounded.height * pixelRatio,
    0,
    0,
    output.width,
    output.height,
  )

  return output.toDataURL('image/png')
}

export function makeExportName(title: string) {
  return sanitizeFileName(title || 'note-canvas-export')
}
