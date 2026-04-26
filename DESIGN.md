# NoteCanvas 设计说明

## 输入与输出

## 输入

- 用户在侧栏管理文件夹和笔记。
- 用户在笔记页中编辑标题、创建文本块、手绘笔迹、绘制几何图形。
- 用户通过矩形框选导出画布区域，可复制、另存或拖出 PNG。

## 输出

- 本地持久化工作库 `library.json`。
- Electron 原生拖拽使用的临时 PNG 文件。
- 可复制到剪贴板或另存到磁盘的 PNG 图像。

# 核心状态

## LibrarySnapshot

- `schemaVersion`
- `lastOpenedNoteId`
- `folders`
- `notes`

## NoteRecord

- `id`
- `folderId`
- `title`
- `revision`
- `document`

## BoardDocument

- `pages`
- `activePageId`

## BoardPageRecord

- `id`
- `width / height`
- `layers`
- `activeLayerId`
- `textBlocks`
- `strokes`
- `shapes`

## LayerRecord

- `id`
- `name`
- `visible`
- `locked`

## Canvas Elements

- `TextBlockRecord`：富文本块，归属于 `layerId`。
- `StrokeRecord`：自由画笔笔迹，归属于 `layerId`。
- `ShapeRecord`：直线、矩形、椭圆，归属于 `layerId`。

# 数据流

1. App 启动后通过 preload 调用主进程读取本地工作库。
2. React 侧栏选择当前文件夹和当前笔记。
3. 编辑器对当前笔记做局部更新，并通过 `touchNote` 提升 `revision`。
4. App 按设置中的自动保存间隔保存完整工作库。
5. 框选导出时，前端截取当前页选区并排除编辑 UI。
6. 生成的 PNG 通过 preload 发送给主进程，用于复制、另存或原生文件拖拽。

# 多页与图层

- 加页是在当前笔记末尾追加新页面，页面在画布中纵向排列。
- 图层作用域为当前页，每页有独立图层列表。
- 图层顺序决定文字、笔迹和图形的叠加顺序。
- 隐藏图层不参与渲染和导出。
- 锁定图层不可新增、擦除、移动或编辑其内容。
- 旧版单画布数据由 `normalizeLibrarySnapshot` 自动迁移成单页默认图层。

# 文本块交互

- 文本块的 `x/y` 表示正文左上角位置。
- 未激活时只显示正文，不显示卡片外框。
- 激活时显示浮动编辑控件；控件不参与正文布局，因此文字位置不发生跳变。
- 缩放画布时，当前缩放比例传给 `react-rnd`，保证拖动和缩放坐标与视觉位置一致。

# 设置与历史

- 主题、默认画布尺寸、默认画笔、自动保存间隔和热键保存在 `localStorage`。
- 本地工作库仍由 Electron 主进程读写。
- Undo/Redo 是当前运行会话内的笔记级内存历史栈，不改变持久化格式。

# 失败路径与降级

- 工作库不存在时自动创建默认库。
- 导出图片失败时保留当前编辑状态，并在界面给出错误提示。
- 文件夹删除时，内部笔记移动到保底文件夹，避免数据丢失。
- 复制 PNG 失败不影响另存和拖拽能力。
