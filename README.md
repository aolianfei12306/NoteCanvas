# NoteCanvas

一个轻量桌面笔记板，定位接近简化版 Apple Notes：

- 左侧文件夹 + 笔记列表
- 右侧自由画布，支持文本块和鼠标手绘
- 区域框选后可直接拖出 PNG 到文件夹或网页
- 本地离线保存，同时为未来同步保留稳定 ID / revision 结构

## 技术栈

- Electron
- React + TypeScript + Vite
- `html-to-image` 用于区域导出
- `react-rnd` 用于文本块拖拽 / 缩放

## 开发

```bash
npm install
npm run dev
```

## 构建与验证

```bash
npm run build
npm run test
```

## 数据落盘

默认保存在 Electron `userData` 目录中的 `workspace/library.json`。

## 当前范围

- 支持本地单机使用
- 支持文件夹分组、笔记增删改
- 支持文本块基础富文本（标题 / 段落 / 列表 / 粗体 / 斜体）
- 支持手绘、擦除、区域导出、复制图片、另存 PNG

不含：

- 云同步
- OCR / 搜索 / 标签
- 移动端适配
- 多人协作
