# Cardify AI v2.0 — 全平台文案重构与爆款卡片 SaaS

## 📁 最终项目结构

```text
cardify-ai/
├── index.html          ← 前端（暗黑玻璃 UI + PDF拖拽解析 + 多平台 Tabs + Swiper视觉卡片 + html2canvas导出）
├── api/
│   └── generate.js     ← Vercel Serverless Function (Groq & Gemini 双引擎 + 3级鉴权 + 限流)
├── vercel.json         ← Vercel 路由与构建配置
├── package.json        ← 依赖与脚本
├── .env.example        ← 环境变量模板
└── DEPLOY.md           ← 本文件
```

---

## 🚀 部署到 GitHub & Vercel

```bash
cd cardify-ai

# 添加升级代码并提交
git add .
git commit -m "🚀 Upgrade to Cardify AI v2.0 (Multi-Platform Content + Visual Card Engine)"

# 推送到 GitHub 远程仓库
git push origin main
```

Vercel 会自动感应 Git 提交并完成秒级重新部署！
