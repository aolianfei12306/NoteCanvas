# Goal

在 `/home/cjdockers/shm/Git/NoteCanvas` 创建一个轻量桌面笔记应用，提供 Apple Notes 风格的文件夹与笔记管理，以及便捷的手绘和区域导出 PNG 拖拽能力。

# Constraints

- 严格遵循用户指定的 `AGENTS.md` 及其关联规范。
- 第一版必须支持鼠标等指针输入。
- 区域导出要求能直接拖到文件夹或网页，落地为完整图片。
- 先做本地离线能力，但为未来同步保留可扩展结构。

# Files in Scope

- Electron 主进程与预加载脚本
- React 前端编辑器与侧边栏
- 共享数据模型
- 过程文档、设计文档、ADR、README

# Steps

1. 建立项目级状态文档、计划文档、设计文档与 ADR
2. 配置 Electron + Vite + React 的桌面应用骨架
3. 实现共享数据模型和本地工作库读写
4. 实现文件夹、笔记列表和标题编辑
5. 实现自由画布文本块、手绘和擦除
6. 实现区域框选、复制、另存和拖拽 PNG 导出
7. 运行构建与测试并回写验证结果

# Risks

- Electron 外部拖拽对文件路径和临时文件生成顺序较敏感。
- `contentEditable` 与 React 状态同步需要避免光标跳动。
- 区域导出需要排除选择框与编辑手柄等装饰性 UI。

# Verification

- `npm run build`
- `npm run test`
- 如开发环境允许，再以 `npm run dev` 做人工交互验证

# Out of Scope

- 云同步
- OCR / 搜索 / 标签
- 移动端适配
- 多人协作
