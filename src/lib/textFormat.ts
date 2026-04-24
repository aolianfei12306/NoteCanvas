export type TextFormatCommand = 'bold' | 'italic' | 'insertUnorderedList'

export function applyTextFormat(command: TextFormatCommand) {
  document.execCommand(command)
}
