export interface HotkeySettings {
  undo: string
  redo: string
  zoomIn: string
  zoomOut: string
}

export interface AppSettings {
  theme: 'system' | 'light' | 'dark'
  defaultBoardWidth: number
  defaultBoardHeight: number
  defaultPenColor: string
  defaultPenWidth: number
  autosaveIntervalMs: number
  hotkeys: HotkeySettings
}

const SETTINGS_KEY = 'notecanvas.settings.v1'

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'system',
  defaultBoardWidth: 1440,
  defaultBoardHeight: 1800,
  defaultPenColor: '#111827',
  defaultPenWidth: 4,
  autosaveIntervalMs: 500,
  hotkeys: {
    undo: 'Ctrl+Z',
    redo: 'Ctrl+Shift+Z',
    zoomIn: 'Ctrl++',
    zoomOut: 'Ctrl+-',
  },
}

function normalizeSettings(input: Partial<AppSettings> | null): AppSettings {
  return {
    ...DEFAULT_APP_SETTINGS,
    ...input,
    hotkeys: {
      ...DEFAULT_APP_SETTINGS.hotkeys,
      ...input?.hotkeys,
    },
  }
}

export function loadAppSettings() {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    return normalizeSettings(raw ? JSON.parse(raw) as Partial<AppSettings> : null)
  } catch {
    return DEFAULT_APP_SETTINGS
  }
}

export function saveAppSettings(settings: AppSettings) {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function applyTheme(theme: AppSettings['theme']) {
  document.documentElement.dataset.theme = theme
}
