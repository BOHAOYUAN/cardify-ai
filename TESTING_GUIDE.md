# 🧪 Cardify.ai v8.0 B2B Studio — 全功能验收与测试文档

本文档为 **Cardify.ai v8.0 B2B 获客引擎与视觉 Studio** 的标准全功能验收测试手册。您可以直接打开 Vercel 线上链接，对照以下 7 个测试案例逐一进行验收。

---

### 📋 案例一：网页 / 文章 URL 1-Click 一键转卡片 (Phase 1 核心爆点)

* **测试目的**：验证输入文章 URL 后能否自动抓取正文，并精炼生成 7 页黄金 LinkedIn Carousel 及其 Lead Magnet 获客闭环。
* **测试步骤**：
  1. 打开 Vercel 线上部署链接；
  2. 清空中间大黑色文本框里的内容；
  3. 粘贴任意网页/博客链接（如：`https://en.wikipedia.org/wiki/Artificial_intelligence`）；
  4. 点击下方紫色大按钮 **`Generate Carousel Pack & Post`**。
* **预期结果**：
  * [x] 顶部跳出蓝色提示 `🔗 Extracting article & insights from URL...`；
  * [x] 秒级抓取成功并提示 `✨ Extracted "Artificial intelligence"!`；
  * [x] 右侧 Visual Studio 生成包含 7 页的 LinkedIn 轮播图；
  * [x] **第 7 页（末页）格式固定为 Lead Magnet 获客闭环**：包含 `🎁 EXCLUSIVE BONUS SOP` 与 `Comment 'GROWTH' below...`；
  * [x] 左下角生成的 LinkedIn 正文末尾附有 `📌 Want the interactive checklist... Check 1st comment below! 👇`。

---

### 📋 案例二：YouTube 视频 1-Click 一键转卡片 (oEmbed 引擎)

* **测试目的**：验证粘贴 YouTube 视频链接能否通过官方 oEmbed 引擎精准抓取视频真实标题与主题，绝不跑偏。
* **测试步骤**：
  1. 粘贴任意 YouTube 视频链接（如：`https://www.youtube.com/watch?v=TS4Us2yLoZo` 好葉演讲视频）；
  2. 点击 **`Generate Carousel Pack & Post`**。
* **预期结果**：
  * [x] 顶部跳出 `🔗 Extracting article & insights from URL...`；
  * [x] 秒级精准提取视频真实标题（`如何让公众表达变成影响力？...`）；
  * [x] 卡片内容 **100% 紧扣《公众表达 / 演讲背稿优缺点》**，绝对不脑补无关的 Growth Hacking 或 Traditional Marketing 词汇。

---

### 📋 案例三：领英评论区第一条获客文案一键复制 (1st Comment Companion)

* **测试目的**：验证生成卡片后，评论区引流文案能否一键复制。
* **测试步骤**：
  1. 在生成任意一组卡片后，看左侧输出栏上方（`Copy Post` 按钮旁边）；
  2. 点击新增的蓝色按钮 **`💬 Copy 1st Comment`**。
* **预期结果**：
  * [x] 提示 `💬 LinkedIn 1st Comment Lead Magnet copied to clipboard!`；
  * [x] 粘贴复制的内容，文本包含带有 Live Link 的领英第一条评论专用模版：
    `👉 Here is the interactive H5 deck & 1-Click SOP: https://...`
    `💬 Comment 'GROWTH' below and I'll DM you the unredacted PDF!`

---

### 📋 案例四：60FPS 纯 Canvas 原生动效短视频预览与导出

* **测试目的**：验证纯 Canvas 2D 动效渲染引擎（零 html2canvas 依赖，永不歪斜与字挤压）。
* **测试步骤**：
  1. 点击右侧工具栏的 **`▶ Preview Motion Reel`** 英雄按钮；
  2. 查看预览弹窗里的 60FPS 动效播放与 Lofi 音效；
  3. 关闭弹窗，点击左下方 **`Export 1080p (Free)`** 按钮。
* **预期结果**：
  * [x] 打开预览**零延迟**，文本矢量级清晰，排版 100% 平直不歪斜；
  * [x] 点击导出后，后台自动渲染并下载 `cardify-reel-xxxx.webm` 1080p 视频；
  * [x] 播放导出的视频，画面逐页流畅翻页，带底噪 BGM 音效。

---

### 📋 案例五：📄 LinkedIn 1-Click 高曝光 PDF 导出

* **测试目的**：验证导出 Multi-Page PDF 功能（LinkedIn 算法权重最高格式）。
* **测试步骤**：
  1. 鼠标悬停在右侧 **`📄 LinkedIn PDF`** 按钮上；
  2. 查看悬停提示（Tooltip）；
  3. 点击 **`📄 LinkedIn PDF`** 导出。
* **预期结果**：
  * [x] 悬停时显示提示框：`💡 LinkedIn Algorithm Booster: PDF Carousels get up to 3-5x more organic reach & DMs!`；
  * [x] 点击后浏览器自动生成并下载 `cardify-carousel-linkedin-xxxx.pdf` 文件；
  * [x] 打开 PDF 文件，每一页为高清 1080x1350 领英卡片。

---

### 📋 案例六：双阶梯 To B 定价弹窗与真实 Dodo Payments 收款闭环

* **测试目的**：验证升级弹窗的月付/年付动态切换与真实 Dodo Payments 官方支付收银台。
* **测试步骤**：
  1. 点击顶部导航栏 **`👑 升级 Pro 版 ($9.9/月)`** 按钮；
  2. 观察默认选中的 **`Annual (Save 35% ⚡️)`** 模式；
  3. 点击 **`Monthly`** 模式切换；
  4. 点击 **`Get Pro Founder`** 或 **`Get Agency Plan`** 跳转。
* **预期结果**：
  * [x] 默认年付：`Pro Founder` 显示 **$149/yr**，`Agency & Team` 显示 **$399/yr**（带有 `MOST POPULAR FOR AGENCIES` 标签）；
  * [x] 切换月付：显示 **$19.9/mo** 与 **$49.9/mo**；
  * [x] 点击跳转后，直接打开对应周期的真实 Dodo Payments 官方安全支付收银台。

---

### 📋 案例七：PLG 高奢商业搭扣 (Live Link H5 视图)

* **测试目的**：验证动态 Live Link H5 视图中的 Product-Led Growth 裂变搭扣。
* **测试步骤**：
  1. 点击右侧工具栏 **`Presenter Mode`**（全屏模式）；
  2. 观察全屏/H5 视图右上角。
* **预期结果**：
  * [x] 右上角清晰渲染高奢微光黑金搭扣：`⚡ Interactive Carousel by Cardify.ai · Create Yours`；
  * [x] 点击该搭扣，在新标签页中顺畅打开 Cardify.ai 首页。
