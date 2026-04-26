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
      setMessage(error instanceof Error ? error.message : '无法打开数据目录')
    }
  }

  async function exportLibrary() {
    try {
      const result = await window.noteCanvas.exportLibrary(library)
      setMessage(result ? `已导出到 ${result}` : '已取消导出')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导出工作库失败')
    }
  }

  return (
    <div className="settings-backdrop" role="dialog" aria-modal="true" aria-label="设置">
      <section className="settings-panel">
        <header className="settings-header">
          <div>
            <p className="eyebrow">Settings</p>
            <h2>设置</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭设置">
            <X size={16} />
          </button>
        </header>

        <div className="settings-grid">
          <label className="setting-field">
            <span>主题</span>
            <select
              value={settings.theme}
              onChange={(event) => updateSettings({ theme: event.target.value as AppSettings['theme'] })}
            >
              <option value="system">跟随系统</option>
              <option value="light">浅色</option>
              <option value="dark">深色</option>
            </select>
          </label>

          <label className="setting-field">
            <span>自动保存间隔</span>
            <select
              value={settings.autosaveIntervalMs}
              onChange={(event) => updateSettings({ autosaveIntervalMs: Number(event.target.value) })}
            >
              <option value={500}>0.5 秒</option>
              <option value={1000}>1 秒</option>
              <option value={3000}>3 秒</option>
              <option value={5000}>5 秒</option>
            </select>
          </label>

          <label className="setting-field">
            <span>默认画布宽度</span>
            <input
              type="number"
              min="640"
              value={settings.defaultBoardWidth}
              onChange={(event) => updateSettings({ defaultBoardWidth: numberValue(event.target.value, settings.defaultBoardWidth) })}
            />
          </label>

          <label className="setting-field">
            <span>默认画布高度</span>
            <input
              type="number"
              min="640"
              value={settings.defaultBoardHeight}
              onChange={(event) => updateSettings({ defaultBoardHeight: numberValue(event.target.value, settings.defaultBoardHeight) })}
            />
          </label>

          <label className="setting-field">
            <span>默认画笔颜色</span>
            <input
              type="color"
              value={settings.defaultPenColor}
              onChange={(event) => updateSettings({ defaultPenColor: event.target.value })}
            />
          </label>

          <label className="setting-field">
            <span>默认画笔粗细</span>
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
          <h3>热键绑定</h3>
          <div className="hotkey-grid">
            <label><span>撤销</span><input value={settings.hotkeys.undo} onChange={(event) => updateHotkey('undo', event.target.value)} /></label>
            <label><span>重做</span><input value={settings.hotkeys.redo} onChange={(event) => updateHotkey('redo', event.target.value)} /></label>
            <label><span>放大</span><input value={settings.hotkeys.zoomIn} onChange={(event) => updateHotkey('zoomIn', event.target.value)} /></label>
            <label><span>缩小</span><input value={settings.hotkeys.zoomOut} onChange={(event) => updateHotkey('zoomOut', event.target.value)} /></label>
          </div>
        </section>

        <section className="settings-section-card">
          <h3>本地数据</h3>
          <p>{dataPath ?? '正在读取数据目录…'}</p>
          <div className="settings-actions">
            <button className="secondary-button" type="button" onClick={openDataPath}>
              <FolderOpen size={14} />
              <span>打开数据目录</span>
            </button>
            <button className="secondary-button" type="button" onClick={exportLibrary}>
              <Save size={14} />
              <span>导出工作库</span>
            </button>
          </div>
          {message ? <p className="settings-message">{message}</p> : null}
        </section>
      </section>
    </div>
  )
}
