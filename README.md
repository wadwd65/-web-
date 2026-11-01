# 初程 FIRST STEP · 主体与音乐统一 v0.29

面向初入职场毕业生的八事务工具原型，音乐为辅助。v0.29统一主站、工作区外层和播放器的钢蓝/冷银视觉，阅读区保留浅底；操作文案更直接，宽桌面显示正在播放的曲名。保留原模型、抽取、旋转、鼠标、入场与八工具，仅电脑端。

先读[本轮视觉复核](docs/30-visual-unity-v029.md)与[全站检查/交付计划](docs/29-site-review-and-delivery-plan.md)。恢复进度运行`npm run resume`，长期记忆入口为[docs/memory](docs/memory/README.md)；旧交接是历史。源码仓库：[wadwd65/-web-](https://github.com/wadwd65/-web-)。

## 本地运行

Node.js 24.21.0+，安装依赖后：

```sh
npm ci
npm run dev -- --port 5211
npm run build
npm test
npm run resume
npm run memory:check
npm run memory:stamp
```

参赛包“开始预览.cmd”固定5186，首页`http://127.0.0.1:5186/?v=0.29#/home`，音乐页`#/music`，版本查`/__first-step-version`。五首本地音频、原始模型与五张场景图随包；在线音源仅失效备用。仅电脑端。GitHub保存源码，不代表已部署公网网站；自行启动时使用上述Vite命令。

## 当前范围

Offer、合同、工资、个税、社保、租房、广州补贴样例、离职均为限定范围本地工具。在线大模型、OCR、RAG、Agent和业务后端未接入，不是全国政策库或代办服务；金额规则不由模型编造。材料仅本次操作保留，只有询问清单和音乐偏好保存到浏览器，刷新边界未改。

## 音乐与署名

五首对应五匣，悬停邻近联动，整匣抽取后显露盘芯；完整播放器中先浏览后播放，底部控制持续。保留旋转、进度、静音/音量、循环、前后曲、拖动和缩放。首页快捷菜单点选即播，重复点当前曲目保留进度；支持Esc、外部点击收起和方向键选曲，不预热完整三维播放器。完整模式准备好再进入，退出后保留场景并暂停渲染，原事务暂停渲染，保持一个audio。

模型：LBEILC / RhineLabUI，经MikeQu223/Rhine-Music-Database取得。固定版本、哈希与完整许可见[来源说明](THIRD_PARTY_NOTICES.md)及public/credits。运行时隐藏原内芯与固定编号、重配材质，安装独立唱片；未复制整套UI、源码或第三方运行时。五张场景来自PRTS，完整清单在public/credits/artwork-source.json；图片版权归原权利方，不纳入模型MIT许可。内部自检不等于用户审美认可，旧v0.24及更早版保留。

## API与下一轮

[API预留说明](docs/25-api-integration.md)：.env.example默认空地址，客户端只有能力查询与合同/租房核对协议，带参数/原文/来源校验和取消超时；尚无业务后端，也未绑定业务按钮，不会自动发送材料。模型密钥必须由后端保管。

下一步按[总排期](docs/29-site-review-and-delivery-plan.md)实施[简易/完整模式与低配自动降级](docs/28-next-two-modes.md)，默认完整、持续低帧转简易、可手动恢复；目前尚未实现。然后接真实AI主线。[持续动态背景](docs/27-next-dynamic-background.md)后置并控制性能负担。85为内部验收目标，不是赛事得分承诺。
