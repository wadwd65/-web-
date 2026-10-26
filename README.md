# 初程 · 毕业生入职助手

第九届传智杯 AI Web 新项目，队名为莱茵生命。当前为 **v0.1 本地规则交互原型**，不是已接入在线 AI 的参赛成品。

业务核心：劳动合同核对；辅助入口为工资条拆解、补贴条件初筛。十四个毕业与入职卡点是后续路线图，不一次扩成十四套系统。

## 运行

Node.js 24.21.0 或以上，npm 11。开发：

```powershell
npm ci
npm run dev -- --port 5175
```

构建与领域验证：

```powershell
npm test
npm run build
```

承载包另有“开始预览.cmd”，可直接预览已有 dist，不必先安装前端依赖。

## 当前已做

- React + TypeScript + Vite；桌面侧栏及窄屏布局。
- 深石墨、半透明玻璃、切角金属与原创 SVG 生命核心的机械科技视觉。
- 合同文字输入、TXT/MD 读取、PDF/图片本地预览、合成示例、用户确认用工类型及期限。
- 部分本地文本规则、引用入口、可编辑询问清单、当前浏览器保存和 TXT 导出。
- 工资已有金额按整数分拆算；不推算地方费率或个税。
- 广州一条官方求职补贴的自述条件初筛；不保证获批。
- 13 项领域测试。

## 尚未做

在线大模型、OCR、PDF 文本解析、RAG、模型工具调用、后端数据库、跨设备账号、完整税费/社保计算、全国补贴检索。不得把本地规则结果冒充 AI 结果。

请先读 docs/00-next-ai-handoff.md 和 docs/design-mechanical-v0.1.md。旧浅色草案 docs/design-direction.md 仅为历史参考，用户已要求机械玻璃方向。

## 文件

- src/App.tsx：主界面与浏览器状态。
- src/styles.css：基础布局、响应式及历史基础样式。
- src/mechanical.css：当前生效的机械玻璃主题，在基础 CSS 后导入。
- src/BioCore.tsx：原创轻量 SVG 首页视觉，不是处理进度。
- src/lib/contracts.ts、wages.ts、policies.ts：当前规则与计算。
- tests/domain.test.ts：领域测试。
- .openai/hosting.json：已创建但尚未发布的私有 Sites 项目标识；将来使用 Sites 时须复用原 id，不得重新创建。

项目没有带入旧参赛包、真实合同、真实工资信息、模型密钥或部署凭证。
