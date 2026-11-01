# 初程 FIRST STEP · 简易/完整模式与 AI 补问 v0.32

面向初入职场毕业生的八项办事工具，音乐为辅助。首页可以直接向 DeepSeek 说明问题，也可以进入工具列表自行操作。三维前景模型的文字与子选项保留点击；后排只能切换预览，拖动、跨区域和转场中的命中不会执行动作。主体和播放器回到浅蓝银色，保留抽取、旋转、单音频、鼠标反馈和入场回放。仅电脑端。

版本入口：[历史版本说明](docs/VERSION_HISTORY.md)、[开发总日志](docs/DEVELOPMENT_LOG.md)、[当前自检](docs/35-v032-independent-review.md)、[后续执行计划](docs/36-next-execution-plan.md)。仓库根目录是当前v0.32完整源码、测试、锁文件与所需静态资源；旧版只记录沿革，不新增多套旧源码或构建快照。已有Git提交历史保留。`v0.33–0.37`是计划，尚未实现。桌面参赛包根“开发总日志.md”与本仓库日志同步维护。

先读[双模式与AI流程说明](docs/34-two-modes-and-guided-ai-v032.md)。前轮优化见[性能说明](docs/32-home-render-performance-v031.md)与[自评/逐步改进表](docs/33-score-and-improvement-plan-v031.md)；AI与工具范围见[31号](docs/31-light-ai-entry-and-tools-v030.md)。恢复开发运行 `npm run resume`，再读 `docs/memory/progress.json` 与 `DECISIONS.md`。源码只同步 [wadwd65/-web-](https://github.com/wadwd65/-web-)。

## 本地运行

需要 Node.js 24.21.0+。开发：

```sh
npm ci
npm run dev -- --port 5211
npm test
npm run build
```

运行已有构建（包含本机 AI 服务，不是只打开 HTML）：

```sh
npm start
```

默认 `http://127.0.0.1:5186/?v=0.32#/home`；工具列表 `#/tools`；音乐 `#/music`。`/__first-step-version` 可核对实际版本。参赛包仍双击“开始预览.cmd”。开发、Vite preview 与保存版都使用同一 AI 网关。

## DeepSeek 配置

密钥只由本机 Node 服务读取。可在项目根目录使用不提交的 `.env.local`，或使用当前用户的 `~/.config/first-step/.env.local`；也可用 `FIRST_STEP_AI_ENV_FILE` 指定私有配置位置。环境变量优先，项目文件优先于用户配置。配置字段见 `.env.example`，不要放进 `VITE_*`。

```dotenv
DEEPSEEK_API_KEY=你的服务端密钥
FIRST_STEP_AI_MODEL=deepseek-flash
```

本机配置不随 Git、dist、截图或参赛快照分发。其他电脑需要单独配置；无密钥会明确提示，八项本地工具仍可用。`GET /api/v1/assistant/status` 只表示是否有配置，实际回复后界面才显示“已回应”。

助手先以真实模型调用非执行型plan_tasks识别当前事项和意图；多事项先选、必要信息再补、未知不猜，旧回复的应用按钮随新问题停用。补问提示由程序安全呈现（guide），解释由模型生成（model）；金额可分次提供并逐段核验原话。之后调用原四项白名单工具：推荐站内入口、已知工资金额核对、已确认全日制合同文字核对、整理询问清单。结果复用原工具与规则；点击操作按钮后才填入目标工具或加入清单。已有表单和文件不会自动发送；点击发送的对话文字会交给 DeepSeek。对话只在页面内存中保留，无服务器会话存储。

本地接口仅监听回环地址，带同源/Host 检查、请求大小限制、并发/频次上限、超时和取消。它不是已部署的公网多用户后端；公网接入的身份、额度隔离与滥用控制仍需补齐。

## 当前范围与缺口

八项限定工具：Offer、合同、工资、个税、社保、租房、广州补贴样例、离职。数额仍按可测试规则计算，未知不补造；合同保留原文、依据与适用边界。没有 OCR、RAG、全国政策库或官方代办权限。已接入小范围多步工具调用，不代表完整多模态签约主线完成。原来的[文档 API 协议](docs/25-api-integration.md)仍仅预留，与本轮真实助手接口分别记录。

默认完整；持续有效低帧自动切简易，页首/聊天可手动切换，本次尊重手动选择。两模式共享表单、结果、清单和单audio。简易卸载三维，不预热模型；完整保留原画面。直接轻量入口`?mode=simple#/home`，普通无参数入口仍默认完整。自动阈值经生产控制器帧序列模拟，不是低配硬件测试。本轮在不降画质下减少DOM重复写入、几何资源与隐藏音乐预热；代表DOM写入1332→9/s、几何153→25，原本约165FPS未明显增加。低配置电脑尚未复测，不能以本机结果保证流畅。[总排期](docs/29-site-review-and-delivery-plan.md)：11/14 功能冻结、11/17 材料完成、11/18 提交；85 是内部目标。

## 音乐与署名

首页“切歌”就地选曲，不跳页；“播放器”打开三维声音档案，返回原工具保留填写和播放。五首本地音频、模型及五张非角色场景随包，音乐仍只有一个 audio。

模型作者 LBEILC / RhineLabUI，经 MikeQu223/Rhine-Music-Database 取得。固定版本、哈希及 MIT 见 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md) 和 `public/credits`。运行时材质、盘芯、布局与交互独立改造；五张 PRTS 场景不属于模型 MIT 许可。旧保存点保留，内部审美检查不等于用户认可。

## 本轮验证

85项自动检查、TypeScript与生产构建通过；21例真实DeepSeek合成评测（保留初轮失败与修正记录）。`npm run evaluate:assistant`会使用服务端配置产生实际模型请求，评测材料全部合成。冷简易首页/播放器无Three/GLB/盘面请求，实际跨模式输入与播放保留。OCR/RAG/公网身份额度隔离仍未完成；只做桌面。
