# 🌸 Sakura Translator（樱花翻译器）

> 一款简洁优雅的 Chrome 翻译扩展。悬停或选中网页上的文字，即可即时翻译单词和句子。

**[English](README_EN.md)** | **[日本語](README_JP.md)**

---

## ✨ 功能特性

- **悬停 / 选中翻译** — 提供两种选择模式：
  - **悬停模式**：将鼠标悬停在文字上，按下修饰键即可自动选中并翻译
  - **手动模式**：拖动选中文字后，按下修饰键触发翻译
- **智能检测** — 自动识别您选中的是单个单词还是整句话
- **词典模式** — 单词翻译提供音标、词性、释义和例句等详细信息
- **句子模式** — 句子翻译提供简洁直接的译文
- **30+ 种语言** — 支持英语、中文（简体/繁体）、日语、韩语、法语、德语、西班牙语、葡萄牙语、俄语、阿拉伯语、印地语、意大利语、荷兰语、泰语、越南语、印尼语、马来语、土耳其语、波兰语、乌克兰语、瑞典语、丹麦语、芬兰语、挪威语、希腊语、捷克语、罗马尼亚语等
- **深色模式** — 自动适配系统主题
- **自定义快捷键** — 可自定义修饰键（Ctrl / Alt / Shift）用于单词和句子选择，带有自动冲突防护
- **自动保存设置** — 所有设置更改即时自动保存，无需手动点击保存按钮
- **弹窗翻译器** — 点击扩展图标打开手动翻译输入框
- **零配置** — 开箱即用，使用免费 API，无需 API 密钥

## 📦 安装方法

1. 克隆或下载本仓库：
   ```bash
   git clone https://github.com/user/sakura-translator.git
   ```
2. 生成图标（仅需一次）：
   ```bash
   node generate-icons.js
   ```
3. 打开 Chrome 浏览器，访问 `chrome://extensions/`
4. 打开右上角的 **开发者模式**
5. 点击 **加载已解压的扩展程序**，选择本项目文件夹
6. 安装完成！在工具栏中找到 **🌸** 图标

## 🎯 使用方法

### 页面翻译（悬停模式 — 默认）

1. 将鼠标**悬停**在网页上的任意文字上
2. 按下 **Ctrl** 键选中并翻译光标下的单词
3. 按下 **Alt** 键选中并翻译整个句子
4. 翻译结果会显示在浮动弹窗中
5. 按 **Escape** 键或点击其他区域关闭弹窗

### 页面翻译（手动模式）

1. **拖动**鼠标选中网页上的任意文字
2. 按住修饰键（默认：**Ctrl**）后松开选区
3. 或先选中文字，再按下修饰键
4. 翻译结果会显示在浮动弹窗中

### 弹窗翻译

1. 点击工具栏中的扩展图标
2. 在输入框中输入或粘贴文字
3. 按 **Ctrl+Enter** 或点击 **Translate** 按钮

### 设置

点击弹窗中的 ⚙️ 齿轮图标进行配置：
- **源语言 / 目标语言** — 从 30+ 种语言中选择，支持一键交换
- **选择模式** — 在悬停模式和手动模式之间切换
- **快捷键** — 自定义单词/句子选择的修饰键（自动防止键冲突）

## 🔌 使用的 API

| API | 用途 | 费用 |
|-----|------|------|
| [Google Translate](https://translate.googleapis.com/) | 多语言翻译，提供扩展词典数据 | 免费 |
| [Free Dictionary API](https://dictionaryapi.dev/) | 英文单词释义、音标和例句 | 免费，无限制 |

## 📁 项目结构

```
sakura-translator/
├── manifest.json           # Chrome 扩展 Manifest V3 配置
├── background.js           # Service Worker（API 调用、语言路由）
├── content/
│   ├── content.js          # 内容脚本（选择检测、弹窗 UI）
│   └── content.css         # 浮动弹窗样式
├── popup/
│   ├── popup.html          # 扩展弹窗页面
│   ├── popup.js            # 弹窗逻辑和设置管理
│   └── popup.css           # 弹窗样式
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── utils/
│   ├── detector.js         # 单词/句子检测
│   ├── translator.js       # 翻译 API 抽象层
│   └── md5.js              # MD5 工具
├── tests/
│   ├── background.unit.spec.js
│   ├── detector.unit.spec.js
│   ├── md5.unit.spec.js
│   ├── content-script.spec.js
│   ├── popup-ui.spec.js
│   └── fixtures.js
├── playwright.config.js    # 测试配置
├── generate-icons.js       # 图标生成脚本
└── package.json
```

## 🧪 测试

本项目使用 **Playwright** 进行单元测试和端到端测试。

```bash
# 运行所有测试
npm test

# 仅运行单元测试
npm run test:unit

# 运行扩展端到端测试
npm run test:extension

# 仅运行弹窗 UI 测试
npm run test:popup

# 仅运行内容脚本测试
npm run test:content
```

## 📄 许可证

MIT
