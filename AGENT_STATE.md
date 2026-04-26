# Current Goal

- 修复文本块激活态与文字位置不一致、缩放后拖动瞬移的问题。
- 新建项目后续改进清单文档。

# Completed Milestones

- 已完成 NoteCanvas 桌面应用基础能力：文件夹、笔记、自由画布、文本块、手绘、框选导出 PNG。
- 已完成 `PROMPTS.md` 中的主要修复与新增功能：多页、图层、设置、Undo/Redo、画笔子工具、调色、窗口退出、文件夹重命名。
- 已恢复源码与核心文档中因编码问题出现的问号文案。
- 已将文本块编辑控件改为浮层，不再改变正文布局位置。
- 已将画布缩放比例传给 `react-rnd`，修复缩放状态下拖动文本块瞬移。
- 已新增 `docs/IMPROVEMENTS.md`，记录后续改进建议。

# Architecture Assumptions

- 使用 Electron + React + TypeScript + Vite。
- 本地工作库继续保存为 Electron `userData/workspace/library.json`。
- `BoardDocument` 使用多页结构；每页包含自己的图层、文本块、笔迹和几何图形。
- 图层顺序决定同一页内全部元素的叠加顺序；隐藏图层不渲染也不导出；锁定图层不可编辑。
- 设置与热键偏好当前保存在 `localStorage`。

# Open Questions

- 是否需要把设置也迁移到主进程文件存储，以便和工作库一起备份。
- 是否需要为文本块增加独立的编辑工具条、对齐线和吸附逻辑。

# Blockers

- 当前无功能性阻塞。
- 尚未在真实 Electron 窗口中完成完整人工交互验收。

# Next Action

- 在桌面窗口中手动验证文本块拖动、缩放下拖动、页面顶部文本块编辑浮层、图层锁定和导出行为。

# Last Verification

- `npm run test`：通过，`shared/model.test.ts` 共 6 项测试通过。
- `npm run lint`：通过。
- `npm run build`：通过，前端与 Electron 产物均构建成功。
