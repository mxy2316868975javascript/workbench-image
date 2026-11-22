# 第三方内容与许可

本仓库的 MIT 许可只覆盖本项目自行编写的代码。`src/lib/` 中整理、改编或运行时加载的第三方提示词、风格库、模板与示例数据，版权归各上游作者所有，按下列许可使用。

> 本文件不是法律意见。若你是上游作者，认为署名或许可信息有误，请开 issue 或私密报告，我们会尽快修正。

## 1. 运行时按需加载的库

这些库的数据不在仓库内分发；用户首次点击加载时，浏览器会从 GitHub Raw 或 jsDelivr 拉取，并缓存到本机 IndexedDB。URL 固定到下列 commit，避免上游 `main` 变动导致行为漂移。

| 库 | 上游 | 许可 | 固定 commit | 缓存 key |
| --- | --- | --- | --- | --- |
| cc2image 模板大全 | [freestylefly/awesome-gpt-image-2](https://github.com/freestylefly/awesome-gpt-image-2) | MIT | `af24cae98d95cc308260b1d637fb1227f9a6e5ca` | `cc2-cookbook` |
| GPT Image 2 精选画廊 | [wuyoscar/GPT-Image2-Skill](https://github.com/wuyoscar/GPT-Image2-Skill) | MIT | `8a1e114104a5c0eb4cdccaad21d90ba7819379a5` | `wy-gallery` |
| 手绘风格配方库 | [threerocks/hand-drawn-styles](https://github.com/threerocks/hand-drawn-styles) | MIT | `b3727de45a2a40f3f3e2ce93f19d4a3c7a0c5f4b` | `hand-drawn-library` |
| 花叔 Design 风格库 | [alchaincyf/huashu-design](https://github.com/alchaincyf/huashu-design) | MIT | `937113133ae446a69ea19d4ceed6cbd2ed3c7735` | `huashu-styles` |

运行时库的示例图仍热链上游地址，图片版权归上游或原始作者所有；本仓库不主张权利。

## 2. 代码内嵌的模板与构建逻辑

| 模板 | 上游 | 许可 | 说明 |
| --- | --- | --- | --- |
| 跨境电商详情页 / 主图 | [coolqoo/1click-ecom-detailpage](https://github.com/coolqoo/1click-ecom-detailpage) | MIT（上游 README 声明，无 LICENSE 文件） | 改编为 `ECOM_TEMPLATE` 的字段与 Prompt 构建逻辑 |
| vane 玩法合集 | [VaneAi888/vane-gpt-image-skills](https://github.com/VaneAi888/vane-gpt-image-skills) | MIT | 改编为 `VANE_TEMPLATE` 的五种玩法与版式 |
| cc2image 内容配图 | [izscc/cc2image](https://github.com/izscc/cc2image) | MIT | 改编为 `CC2_TEMPLATE` 的视觉锚点与风格表 |
| PPT 逐页生图 | [Ronnie2025/codex-ppt-skill](https://github.com/Ronnie2025/codex-ppt-skill) | MIT | 改编为 `PPT_TEMPLATE` 的页面结构 |
| Gorden 图片型 PPT | [GordenSun/GordenSuperPPTSkills](https://github.com/GordenSun/GordenSuperPPTSkills) | 上游 README：可商用，必须标明 GitHub 出处或 @Gorden Sun | 改编为 `GORDEN_TEMPLATE`；README 与模板描述保留署名 |
| 电商执行卡（视觉文案 SOP） | [feichanggege/ecommerce-visual-copywriting-skill](https://github.com/feichanggege/ecommerce-visual-copywriting-skill) | MIT | 改编为 `EVC_TEMPLATE` 的执行卡与文案规则 |
| 文档配图（三风格） | [op7418/Document-illustrator-skill](https://github.com/op7418/Document-illustrator-skill) | MIT | 改编为 `DOC_ILLU_TEMPLATE` 的三种风格 |
| 论文方法图解 | [zsyggg/paper-craft-skills](https://github.com/zsyggg/paper-craft-skills) | MIT（上游 README 声明，无 LICENSE 文件） | 改编为 `PAPER_COMIC_TEMPLATE` |
| 小黑怪诞正文配图 | [helloianneo/ian-xiaohei-illustrations](https://github.com/helloianneo/ian-xiaohei-illustrations) | MIT | 改编为 `XIAOHEI_TEMPLATE` 的结构与 IP 约束 |
| 极简 Zine 海报 | [LiamGvchi/gc-minimal-zine-poster](https://github.com/LiamGvchi/gc-minimal-zine-poster) | MIT | 改编为 `ZINE_TEMPLATE` 的布局与材质配方 |

## 3. MIT 许可文本

以下 MIT 许可适用于第 1、2 节中标注为 MIT 的来源。各来源的版权行如下：

- Copyright (c) 2026 freestylefly
- Copyright (c) 2026 Wuyoscar
- Copyright (c) 2026 liulei
- Copyright (c) 2026 alchaincyf（花叔 · 花生）
- Copyright (c) 2026 VaneAi888
- Copyright (c) 2026 izscc
- Copyright (c) 2026 Ronnie2025
- Copyright (c) 2026 OpenClaw Community
- Copyright (c) 2026 歸藏
- Copyright (c) 2026 Ian
- Copyright (c) 2026 LiamGvchi
- `coolqoo/1click-ecom-detailpage`、`zsyggg/paper-craft-skills`：上游 README 声明 MIT，但未提供 LICENSE 文件或版权行；此处按项目名保留来源，建议上游后续补充标准许可文件。

```text
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 4. Gorden 图片型 PPT 的署名要求

`GordenSun/GordenSuperPPTSkills` 上游 README 写的是：

> 可以商用，必须标明 GitHub 出处，或标记出作者 @Gorden Sun。

本仓库在 README 功能列表、模板描述和本文件中保留 `GordenSun/GordenSuperPPTSkills` 与 `Gorden Sun` 的署名。分发或再发布时请不要删除、遮蔽或弱化该署名。

## 5. 已移除的内容

以下内容曾出现在早期开发版本中，因许可与本项目 MIT 分发不兼容，已从仓库移除，不再包含在本版本中：

- `op7418/guizang-social-card-skill`（AGPL-3.0）的色板与版式数据
- `yjz211/vivid-illustration-skill`（个人非商业许可，禁止演绎与再分发）
- `BaYue-SYJ/shuixian-prompts`（署名 + 非商业许可）
- `justlovemaki/LumaRescue`（未声明许可）
- `cclank/recipe-generator`（未声明许可）
- `liangdabiao/ecom-details-image`（未声明许可）

如你从旧版本升级，旧的模板库缓存会被一次性清理；由这些模板生成并保存在自定义模板中的 Prompt 仍归你所有，但不再随内置入口提供。

## 6. 贡献规则

新增第三方模板、风格、提示词或数据前，必须满足：

1. 上游有明确、与本项目 MIT 分发兼容的许可；没有 LICENSE 且 README 未明确授权的，不接受。
2. 在本文件中补充来源、许可、版权行和改编说明。
3. 运行时拉取的内容固定到 commit，不要在代码里直接使用 `main` / `master`。
4. 不引入 AGPL、GPL、非商业、禁止演绎或“保留所有权利”的内容到默认发行版。

仅用于个人学习、未公开分发的实验内容，也必须放在独立目录并明确标注，不得混入默认构建。
