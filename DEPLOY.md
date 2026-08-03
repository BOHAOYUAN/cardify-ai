# Cardify AI — 一键部署指引

## 📁 最终项目结构

```
cardify-ai/
├── index.html          ← 前端（Swiper 卡片 + html2canvas 导出）
├── api/
│   └── generate.js     ← Vercel Serverless Function（OpenAI 调用）
├── vercel.json         ← Vercel 路由与构建配置
├── package.json        ← 依赖（openai SDK）
├── .env.example        ← 环境变量模板
├── .gitignore          ← 排除 .env / node_modules
└── DEPLOY.md           ← 本文件
```

---

## 🚀 第一步：获取 OpenAI API Key

1. 访问 https://platform.openai.com/api-keys
2. 点击 **Create new secret key**
3. 复制保存（只显示一次！）

> 💡 推荐使用 `gpt-4o-mini`：速度快、成本极低（生成一组卡片约 $0.001 美元），每月 $5 额度可生成约 5000 次。

---

## 🐙 第二步：上传到 GitHub

打开命令行，在项目根目录依次执行：

```bash
# 初始化 git 仓库
git init

# 添加所有文件
git add .

# 首次提交
git commit -m "🚀 Initial commit: Cardify AI MVP"

# 在 GitHub 新建一个仓库（名字: cardify-ai），然后：
git remote add origin https://github.com/你的用户名/cardify-ai.git
git branch -M main
git push -u origin main
```

---

## ▲ 第三步：部署到 Vercel（3 分钟上线）

### 方式 A：网页控制台（推荐新手）

1. 访问 https://vercel.com → 用 GitHub 账号登录
2. 点击 **Add New Project** → 选择 `cardify-ai` 仓库 → **Import**
3. Framework Preset 选 **Other**（不是 Next.js）
4. 点击 **Deploy** → 等待约 60 秒

### 方式 B：命令行（更快）

```bash
# 全局安装 Vercel CLI（只需一次）
npm i -g vercel

# 在项目目录登录并部署
vercel

# 生产部署
vercel --prod
```

---

## 🔑 第四步：配置 OpenAI API Key（最关键！）

部署完成后，在 Vercel Dashboard：

1. 进入项目 → **Settings** → **Environment Variables**
2. 添加以下变量：

| Name | Value | Environment |
|------|-------|-------------|
| `OPENAI_API_KEY` | `sk-xxxxxxxx...` | Production, Preview |
| `OPENAI_MODEL` | `gpt-4o-mini` | Production, Preview |

3. 点击 **Save** → 回到 **Deployments** → 点击 **Redeploy**（让环境变量生效）

---

## ✅ 验证部署成功

访问你的 Vercel 域名（如 `cardify-ai.vercel.app`），然后：

```bash
# 用 curl 测试 API 端点
curl -X POST https://cardify-ai.vercel.app/api/generate \
  -H "Content-Type: application/json" \
  -d '{"text": "AI is transforming every industry by automating routine tasks and enabling new capabilities that were previously impossible. Companies that adopt AI early are seeing significant productivity gains of 30-40% in knowledge work."}'
```

应该返回完整的 JSON 卡片数据 ✅

---

## 💰 成本估算

| 服务 | 费用 |
|------|------|
| Vercel 托管 | **$0/月**（免费套餐：100GB 带宽，足够前期） |
| OpenAI gpt-4o-mini | **约 $0.001/次生成**（$5 可用约 5000 次） |
| 域名（可选）| $10-15/年（在 Namecheap / Cloudflare 购买） |
| **合计启动成本** | **$0 ~ $15** |

---

## 🔜 上线后第一周行动清单

- [ ] 在 **Product Hunt** 发布（周二/周三 00:01 PST 发布效果最佳）
- [ ] 发 **Twitter/X 帖子**：录一个 30 秒的 demo GIF（用 ScreenToGif 录制）
- [ ] 提交到 **Hacker News Show HN**
- [ ] 在 **Reddit r/SideProject** 和 **r/ChatGPT** 发帖
- [ ] 在卡片水印区加付费版去水印功能 → 接入 Lemon Squeezy 支付

---

## 🛠 本地开发调试

```bash
# 安装依赖
npm install

# 创建本地环境变量文件
cp .env.example .env.local
# 然后编辑 .env.local，填入真实的 OPENAI_API_KEY

# 启动本地开发服务器（模拟 Vercel 环境）
npx vercel dev
# 访问 http://localhost:3000
```

> ⚠️ 直接用浏览器打开 `index.html`（file:// 协议）时，`/api/generate` 无法访问，会自动 fallback 到 Demo 数据展示。必须通过 `vercel dev` 或部署到 Vercel 后才能使用真实 AI 生成。
