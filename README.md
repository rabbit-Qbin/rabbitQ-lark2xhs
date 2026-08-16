# rabbitQ-lark2xhs

**小兔Q彬 · 把飞书云文档或 Markdown 变成可继续编辑的小红书 3:4 图文 Studio。**

`rabbitQ-lark2xhs` 是一个面向 Codex / Agent 的本地 Skill，也可以直接作为 Node.js 工具使用。输入飞书云文档链接、Markdown、图片附件目录或导出 ZIP，得到一个本地可编辑的 `xhs-studio.html`。先在浏览器里调整文字、图片和分页；确认后再按需导出 1080 × 1440 PNG ZIP。

![rabbitQ-lark2xhs 飞书云文档或 Markdown 转小红书 3:4 图文工作流](assets/rabbitq-xhs-workflow.svg)

## 它解决什么

飞书适合写长文，小红书需要逐页图文。这个项目把中间最耗时的「整理内容 → 做版式 → 逐页出图」变成一个可编辑的本地工作台：

```text
飞书文档 / Markdown + 图片
→ 转成连续的 3:4 图文页面
→ 在本地 Studio 继续调整
→ 需要时导出 PNG ZIP
```

内容、图片和草稿都在本机处理；不会自动上传或发布到小红书。

## 你会得到什么

- **直接可编辑**：不是一次性图片。文字、列表、引用、卡片、代码块、表格和图片都能继续改。
- **整行改样式更稳**：双击、三击或拖选一行后，可直接切换正文、标题、引用、卡片等样式；不会误带下一段或凭空增加空行。
- **飞书可直达**：可直接给 `/wiki/` 或 `/docx/` 链接，脚本会通过 `lark-cli` 导出为标准 Markdown 包。
- **AI 两遍整理**：先照实保留 Markdown 样式，再逐段逐句检查标题、卡片、引用、列表和行内强调是否匹配；只在合适时应用，不按数量硬塞样式。源 Markdown/HTML 已标记的代码块照实保留，实际 CLI 指令、脚本和配置代码也可转成代码块；命令行说明句和普通提示词不会误转。
- **适合长文**：正文会连续分页；标题、图片和短表格保持完整，列表等内容可自然续到下一页。
- **封面形式可选**：支持全封面、半封面、无封面，也支持嵌入已有封面图。全封面是一张完整成图，图中文字不能在 Studio 内单独编辑；半封面和无封面的标题、副标题可以直接编辑。无封面正文会跟在副标题下方 40px，并在编辑首页后锁定位置，切页不会跳动。
- **书刊正文风格**：正文默认使用 Noto Serif SC 42px / 69px / 500 字重；卡片与引用正文为 40px，卡片默认加粗；代码块为 38px。缺少 Noto Serif SC 时可由脚本自动下载安装，无需管理员权限。
- **颜色可以自己取**：除内置背景和强调色外，可直接选择自定义页面背景与强调母色。强调文字、色带、卡片浅底和下划线会自动生成协调的深浅层级，并保证强调文字可读。
- **按最终版导出**：确认预览后再导 PNG ZIP，避免反复改图、重新排版。

## 它不是什么

- 它不是小红书自动发布器，不会登录账号或代替用户发布内容。
- 它不是只能看不能改的成图模板；核心交付物是可继续编辑的本地 Studio。
- 它不会把视频塞进图文；视频需要另行上传或先截帧。

## 快速开始

```bash
git clone https://github.com/rabbit-Qbin/rabbitQ-lark2xhs.git
cd rabbitQ-lark2xhs
npm ci

# 检查并按需安装 Noto Serif SC
node scripts/ensure-font.js

# 从 Markdown、文章目录或 ZIP 生成 Studio
node scripts/convert.js "/path/to/article"
```

直接从飞书云文档开始：

```bash
# 首次使用先安装并登录飞书 CLI
npm install -g @larksuite/cli
lark-cli auth login --scope "wiki:wiki:readonly docx:document:readonly"

node scripts/lark-export.js "https://xxx.feishu.cn/wiki/文档token" -o "/path/to/article"
node scripts/convert.js "/path/to/article"
```

打开输出目录的 `xhs-studio.html` 即可编辑。默认不会导出图片；需要成图时，在 Studio 中点击“批量导出 PNG ZIP”。

## 常用场景

| 你手里有什么 | 怎么开始 |
| --- | --- |
| 飞书文档链接 | 运行 `lark-export.js`，再运行 `convert.js` |
| 本地 Markdown 和配图 | 把 Markdown 文件或所在目录交给 `convert.js` |
| 飞书导出的 ZIP | 直接把 ZIP 交给 `convert.js` |
| 已做好封面 | 加 `--cover-mode full --cover-image "/path/to/cover.png"` |

封面形式通过 `--cover-mode full|half|none` 指定，默认是 `half`。`full` 是不可拆分编辑的完整封面图；`half` 的图片位于上半页，标题和副标题仍可编辑；`none` 不使用封面图。

### 没有内置生图能力时：自配 API 生封面（可选）

如果 Agent 没有可调用的生图工具，可配置 **OpenAI 兼容 Images API** 后使用本地脚本。密钥只从环境变量读取，不会写入 HTML、manifest 或 Git：

```powershell
$env:XHS_IMAGE_API_BASE = "https://api.openai.com/v1"
$env:XHS_IMAGE_API_KEY = "你的密钥"
$env:XHS_IMAGE_MODEL = "gpt-image-1"

node scripts/generate-cover.js `
  --prompt "干净的编辑感封面主视觉，主题是飞书文档转小红书图文，不要生成文字" `
  --output "D:\output\cover.png" `
  --size 1080x1440

node scripts/convert.js "/path/to/article" --cover-mode full --cover-image "D:\output\cover.png"
```

半封面将 `--size` 改为 `1080x720`。可先加 `--dry-run` 检查请求配置；脚本不接收命令行 API Key，已有文件也不会覆盖，除非显式加 `--force`。

封面字段也可以写进原稿：

```yaml
---
title: 飞书云文档转 3:4 图文
subtitle: 写完直接转，还能继续编辑
---
```

## 作为 Agent Skill 使用

将仓库目录安装到 Agent 的 `skills` 目录，并保持名称为 `rabbitq-lark2xhs`。当用户给出飞书链接、Markdown、导出目录或 ZIP，并要求生成、修复或验证小红书图文时即可调用。推荐提示词：

```text
使用 $rabbitq-lark2xhs，把这份飞书文档或 Markdown 转成可编辑的小红书 3:4 图文 Studio。
```

具体的输入约定、自动样式判断、封面决策、编辑规则与验收流程都在 [SKILL.md](SKILL.md) 中，避免 README 变成一份面向 Agent 的行为规范。

## 项目文档

- [输入与 Markdown 约定](references/markdown-patterns.md)
- [Studio 编辑说明](docs/xhs-tool-intro.md)
- [版式与分页约定](references/layout-spec.md)

## 边界

- 不自动发布到小红书。
- 视频不会进入图文；需要另行上传或先截帧。
- 导出效果以当前 Chrome / Chromium 预览为准。

## 开发验证

```bash
npm test
node --check scripts/convert.js
```

当前发布版本：`0.9.26`。

## 作者

小兔Q彬 / [rabbitQ](https://github.com/rabbit-Qbin)
