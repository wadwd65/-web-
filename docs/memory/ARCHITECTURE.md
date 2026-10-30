# 架构排查与演进

## 当前事实
- App.tsx维护路由、原三项本地业务与询问清单，NewModules.tsx维护其余五项。各业务组件仍常驻，切音乐不卸载输入。规则在lib/domain、eight-tools及terminal-state；不是在线LLM模型。
- ExperienceWorkspace.tsx把三维、工作区、目录、入场、快捷键、音乐和若干延时焦点操作集中在一起，状态多且耦合。
- TaskArrayScene和MusicArchiveScene是两个独立Three renderer/镜头/材质系统。音乐覆盖时事务场景暂停；这是合理隔离，但没有共同的模式进入/退出协调层。
- MusicPlayer原以open布尔值立即showModal；关闭立即拆场景，没有退出动画。异步纹理/场景装载与CSS淡入并未协调，导致突然换底色与内容跳入。
- base/experience/workbench/motion/scene/tool/music样式逐轮叠加。motion-terminal重复覆盖同一首页、阅读层和背景，部分字段另有!important；不同入口使用独立字色和尺寸。
- 首页世界位置大多固定为x=2，缺少与左文案/可用视口对应的整体锚点；后排物体透明叠加，粗边框、多层文字和浅色环境一起削弱形体。
- 八模块ready只表示限定本地工具可体验，不等于LLM/OCR/RAG/Agent或后端完成；现有几何测试部分针对历史模型，不能作为当前所有动效的验收。

## 本轮改造边界
- 引入有测试的音乐模式状态机：closed/preparing/entering/open/leaving。场景就绪再进入；退出动画后才卸载；返回/重开可中断。音频状态独立，不随视觉阶段重建。
- 引入统一视觉变量，整理首页样式和工作区转场职责，移除相互覆盖的旧装饰规则；不把新主题再堆成第九层。
- 首页模型按文案/画布比例确定屏幕锚点，减轻机壳厚度，保留真三维、数据与点云迁移。音乐保留抽取开盖与播放旋转。
- 不在本轮重写业务规则或引入“假AI”。后续AI能力按BACKLOG的服务/证据层推进。

## 后续扩展
业务能力和金额规则不依赖Three、音乐或CSS；新增在线服务应通过类型化适配层，结果仍复用已有证据/未知状态。进一步拆分ExperienceWorkspace的目录/焦点/工作区状态，须有对应往返验证，不为重构而丢功能。


## 本轮收窄后的实际结果

用户将工作收窄为音乐UI，首页模型锚点和业务状态拆分没有实施，仍是后续建议。已落地音乐模式状态机、预热与退出保留、同画布镜头切换；音乐页样式重写为单一文件职责。进一步明确允许复用原始模型，GLTFLoader载入固定本地资源，原始几何来源和运行时改造可追溯。未接入任何在线业务AI服务。

## v0.25 实际改造

音乐场景在首次使用/入口预热后常驻，关闭时停止RAF而保留GPU资源。薄前片关闭transmission，compileAsync在可见运动前完成。archive-motion提供有限920ms时间曲线，姿态从当前值重新定向；不等上一个演员归位。music-artwork共享五曲图像、主题色和情绪（手工标签），模型与封面共用；music-atmosphere为固定缓冲粒子+光场、通过uniform逐曲插值及鼠标射线投影；MusicSpectrum为单audio既有分析链的24Hz小图。素材清单独立于MIT模型许可。

模式状态机仍负责准备/进入/打开/退出/关闭；prepared场景跨路由保留，业务与单audio不卸载。性能诊断只在perf=1时启用，音乐计数独立，过渡采样与稳态采样区分。图片、音频和模型均本地，首访解码/编译仍需准备阶段，不把本机暖机采样当普遍保证。

## v0.26 入口分离

MusicQuickPicker仅管理原生popover与键盘/焦点，调用Soundtrack现有playTrack/toggle，不持有audio或动画循环。MusicEntry只在完整播放器按钮hover/focus时预热三维；ExperienceWorkspace传入路由/模式键以收起快捷菜单，八业务组件及唯一audio保持常驻。
