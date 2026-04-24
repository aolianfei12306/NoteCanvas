# 输入与输出

## 输入

- 用户在左侧管理文件夹和笔记
- 用户在笔记页中输入标题、编辑文本块、使用指针绘制线条
- 用户使用矩形框选选区，并触发拖拽 / 复制 / 另存 PNG

## 输出

- 本地持久化的工作库 `library.json`
- Electron 原生拖拽的 PNG 文件
- 可复制到剪贴板的 PNG 图像

# 核心状态

## LibrarySnapshot

- `schemaVersion`
- `lastOpenedNoteId`
- `folders`
- `notes`

## FolderRecord

- `id`
- `name`
- `parentId`
- `createdAt`
- `updatedAt`

## NoteRecord

- `id`
- `folderId`
- `title`
- `createdAt`
- `updatedAt`
- `revision`
- `document`

## BoardDocument

- `width`
- `height`
- `textBlocks`
- `strokes`

## TextBlockRecord

- `id`
- `x / y / width / height`
- `html`
- `createdAt`
- `updatedAt`

## StrokeRecord

- `id`
- `color`
- `width`
- `opacity`
- `points`

# 数据流

1. App 启动时通过 preload 调用主进程，读取本地工作库
2. React 侧边栏切换当前文件夹与当前笔记
3. 编辑器对当前笔记做局部更新，并回写成完整 `NoteRecord`
4. App 对 `library` 做防抖保存
5. 区域导出时，前端对画布节点进行截图并裁剪选区
6. 生成的 PNG 通过 preload 发给主进程：
   - 复制到剪贴板
   - 另存为 PNG
   - 先写入临时文件，再启动原生拖拽

# 关键不变量

- 所有文件夹、笔记、文本块、笔画都使用稳定 UUID
- 笔记每次变更都提升 `revision` 并刷新 `updatedAt`
- `lastOpenedNoteId` 必须指向现存笔记，否则回退到第一条笔记
- 导出选区坐标始终相对画布本身，而不是相对滚动视口

# 失败路径与降级

- 工作库不存在时自动创建默认库
- 导出图片失败时保留当前编辑状态，并在界面给出错误提示
- 文件夹删除时若仍有笔记，则自动移动到保底文件夹，避免数据丢失
- 复制 PNG 失败时不影响另存与拖拽能力
