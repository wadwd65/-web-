# 初程 FIRST STEP · 桌面首页信息优化 v0.27

面向初入职场毕业生的八事务工具原型，含独立的三维声音档案。本轮强化首页的产品用途、当前任务和主要操作，将八项工具整理成带用途说明的两行直接入口，补充背景光场、空间测绘线与使用提醒；保留原有三维、八业务、快捷选曲及完整播放器。仅电脑端，用户已明确暂缓手机。

先读[本轮首页与检查记录](docs/24-home-information-review.md)。恢复进度运行`npm run resume`，长期记忆入口为[docs/memory](docs/memory/README.md)；旧交接是历史。源码仓库：[wadwd65/-web-](https://github.com/wadwd65/-web-)。

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

参赛包“开始预览.cmd”固定5186，首页`http://127.0.0.1:5186/?v=0.27#/home`，音乐页`#/music`，版本查`/__first-step-version`。五首本地音频、原始模型与五张场景图随包；在线音源仅失效备用。仅电脑端。GitHub保存源码，不代表已部署公网网站；自行启动时使用上述Vite命令。

## 当前范围

Offer、合同、工资、个税、社保、租房、广州补贴样例、离职均为限定范围本地工具。在线大模型、OCR、RAG、Agent和业务后端未接入，不是全国政策库或代办服务；金额规则不由模型编造。材料仅本次操作保留，只有询问清单和音乐偏好保存到浏览器，刷新边界未改。

## 音乐与署名

五首对应五匣，悬停邻近联动，整匣抽取后显露盘芯；完整播放器中先浏览后播放，底部控制持续。保留旋转、进度、静音/音量、循环、前后曲、拖动和缩放。首页快捷菜单点选即播，重复点当前曲目保留进度；支持Esc、外部点击收起和方向键选曲，不预热完整三维播放器。完整模式准备好再进入，退出后保留场景并暂停渲染，原事务暂停渲染，保持一个audio。

模型：LBEILC / RhineLabUI，经MikeQu223/Rhine-Music-Database取得。固定版本、哈希与完整许可见[来源说明](THIRD_PARTY_NOTICES.md)及public/credits。运行时隐藏原内芯与固定编号、重配材质，安装独立唱片；未复制整套UI、源码或第三方运行时。五张场景来自PRTS，完整清单在public/credits/artwork-source.json；图片版权归原权利方，不纳入模型MIT许可。内部自检不等于用户审美认可，旧v0.24及更早版保留。
