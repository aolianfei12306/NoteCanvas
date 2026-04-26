# Goal

完成 `PROMPTS.md` 中列出的修复和新增功能，并修复后续发现的文本块拖动/定位问题。

# Constraints

- 遵循仓库中的 `.AGENTS` 工作规范。
- 保留本地离线数据结构，并兼容旧版单画布工作库。
- 不覆盖用户未跟踪文件或无关工作区内容。

# Files in Scope

- `shared/model.ts`
- `src/App.tsx`
- `src/components/*`
- `src/lib/*`
- `src/index.css`
- `electron/*`
- `vite.config.ts`
- `docs/*`
- 状态和设计文档

# Completed Steps

1. 移除空画布提示。
2. 简化文本块外框显示逻辑。
3. 修复 Electron 窗口关闭和开发进程退出链路。
4. 修复文件夹重命名。
5. 增加 `Ctrl + 滚轮` 画布缩放。
6. 增加多页模型和加页控件。
7. 增加图层模型和图层控件。
8. 增加设置面板。
9. 增加笔记级 Undo/Redo。
10. 增加几何图形画笔子工具。
11. 增加 Apple Notes 风格调色控件。
12. 将画笔子工具和调色控件限制在画笔模式下方显示。
13. 恢复因编码问题变成问号的中文文案。
14. 修复文本块激活态文字位置跳变和缩放拖动瞬移。
15. 新增 `docs/IMPROVEMENTS.md` 记录后续改进建议。

# Verification

- `npm run test`
- `npm run lint`
- `npm run build`

# Remaining Manual Checks

- 在真实 Electron 窗口中验证文本块拖动、缩放拖动、关闭窗口退出、拖出 PNG、图层显隐/锁定、设置面板和导出入口。

# Out of Scope

- 云同步。
- OCR / 搜索 / 标签。
- 多人协作。
- 移动端适配。
