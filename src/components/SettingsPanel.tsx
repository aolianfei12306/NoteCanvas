import { useState } from 'react'
import { FolderOpen, Save, X } from 'lucide-react'
import type { LibrarySnapshot } from '../../shared/model'
import type { AppSettings } from '../lib/settings'

interface SettingsPanelProps {
  settings: AppSettings
  library: LibrarySnapshot
  dataPath: string | null
  onChange: (settings: AppSettings) => void
  onClose: () => void
}

function numberValue(value: string, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function SettingsPanel({
  settings,
  library,
  dataPath,
  onChange,
  onClose,
}: SettingsPanelProps) {
  const [message, setMessage] = useState<string | null>(null)

  function updateSettings(partial: Partial<AppSettings>) {
    onChange({
      ...settings,
      ...partial,
    })
  }

  function updateHotkey(key: keyof AppSettings['hotkeys'], value: string) {
    onChange({
      ...settings,
      hotkeys: {
        ...settings.hotkeys,
        [key]: value,
      },
    })
  }

  async function openDataPath() {
    try {
      await window.noteCanvas.openDataPath()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '????????')
    }
  }

  async function exportLibrary() {
    try {
      const result = await window.noteCanvas.exportLibrary(library)
      setMessage(result ? `???? ${result}` : '?????')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '???????')
    }
  }

  return (
    <div className="settings-backdrop" role="dialog" aria-modal="true" aria-label="??">
      <section className="settings-panel">
        <header className="settings-header">
          <div>
            <p className="eyebrow">Settings</p>
            <h2>??</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="????">
            <X size={16} />
          </button>
        </header>

        <div className="settings-grid">
          <label className="setting-field">
            <span>??</span>
            <select
              value={settings.theme}
              onChange={(event) => updateSettings({ theme: event.target.value as AppSettings['theme'] })}
            >
              <option value="system">????</option>
              <option value="light">??</option>
              <option value="dark">??</option>
            </select>
          </label>

          <label className="setting-field">
            <span>??????</span>
            <select
              value={settings.autosaveIntervalMs}
              onChange={(event) => updateSettings({ autosaveIntervalMs: Number(event.target.value) })}
            >
              <option value={500}>0.5 ?</option>
              <option value={1000}>1 ?</option>
              <option value={3000}>3 ?</option>
              <option value={5000}>5 ?</option>
            </select>
          </label>

          <label className="setting-field">
            <span>??????</span>
            <input
              type="number"
              min="640"
              value={settings.defaultBoardWidth}
              onChange={(event) => updateSettings({ defaultBoardWidth: numberValue(event.target.value, settings.defaultBoardWidth) })}
            />
          </label>

          <label className="setting-field">
            <span>??????</span>
            <input
              type="number"
              min="640"
              value={settings.defaultBoardHeight}
              onChange={(event) => updateSettings({ defaultBoardHeight: numberValue(event.target.value, settings.defaultBoardHeight) })}
            />
          </label>

          <label className="setting-field">
            <span>??????</span>
            <input
              type="color"
              value={settings.defaultPenColor}
              onChange={(event) => updateSettings({ defaultPenColor: event.target.value })}
            />
          </label>

          <label className="setting-field">
            <span>??????</span>
            <input
              type="range"
              min="2"
              max="18"
              value={settings.defaultPenWidth}
              onChange={(event) => updateSettings({ defaultPenWidth: Number(event.target.value) })}
            />
          </label>
        </div>

        <section className="settings-section-card">
          <h3>????</h3>
          <div className="hotkey-grid">
            <label><span>??</span><input value={settings.hotkeys.undo} onChange={(event) => updateHotkey('undo', event.target.value)} /></label>
            <label><span>??</span><input value={settings.hotkeys.redo} onChange={(event) => updateHotkey('redo', event.target.value)} /></label>
            <label><span>??</span><input value={settings.hotkeys.zoomIn} onChange={(event) => updateHotkey('zoomIn', event.target.value)} /></label>
            <label><span>??</span><input value={settings.hotkeys.zoomOut} onChange={(event) => updateHotkey('zoomOut', event.target.value)} /></label>
          </div>
        </section>

        <section className="settings-section-card">
          <h3>????</h3>
          <p>{dataPath ?? '?????????'}</p>
          <div className="settings-actions">
            <button className="secondary-button" type="button" onClick={openDataPath}>
              <FolderOpen size={14} />
              <span>??????</span>
            </button>
            <button className="secondary-button" type="button" onClick={exportLibrary}>
              <Save size={14} />
              <span>?????</span>
            </button>
          </div>
          {message ? <p className="settings-message">{message}</p> : null}
        </section>
      </section>
    </div>
  )
}
