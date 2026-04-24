# Context

需要在 Ubuntu 桌面环境下实现一个轻量笔记应用，并满足“区域导出后拖到文件夹或网页就是完整图片”的强要求。浏览器纯 Web 实现对跨应用文件拖拽能力有限，同时项目还需要本地离线落盘和未来同步扩展空间。

# Decision

采用 Electron + React + TypeScript 架构：

- Electron 负责桌面窗口、文件系统和原生拖拽 / 剪贴板能力
- React 负责文件夹列表、笔记列表和自由画布编辑器
- 工作库先以本地 JSON 保存，包含稳定 ID、schemaVersion 和 revision 字段

# Alternatives Considered

## 纯 Web / PWA

- 优点：部署简单
- 缺点：拖到系统文件夹形成真实图片文件的体验不稳定，难满足核心诉求

## Tauri

- 优点：体积更轻
- 缺点：当前环境无 Rust 工具链，首轮交付成本更高

## 直接上数据库或同步后端

- 优点：为后续同步更完整
- 缺点：超出第一版范围，拖慢核心交互落地

# Why This Choice

- 与用户的桌面交付偏好一致
- 能直接使用 Electron 原生文件拖拽与剪贴板
- 当前环境已有 Node / npm，可快速落地
- 允许先完成本地单机体验，再逐步演进数据层

# Consequences

- 项目依赖 Electron，包体比纯 Web 更大
- 需要维护 preload / IPC 边界
- 未来若做同步，可保留现有数据模型并替换底层 repository
