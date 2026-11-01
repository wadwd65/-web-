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

## v0.27 首页展示职责

HomeTaskDirectory只负责八项名称/用途与原onOpen、onPreview回调；HomeBackdrop为静态SVG/CSS装饰。home-overview.css集中管理首页层级与桌面尺寸适应，工作区仍使用原布局。ExperienceWorkspace继续持有业务/音频状态，场景设置只改为原生details并在模式切换时收起。原TaskArrayScene与MusicArchiveScene代码未替换；背景没有额外RAF。

## v0.28 交互与服务边界

PointerFeedback使用一个稳定portal宿主，按事件目标移动到body/原生dialog/popover，React管理其11个池化子节点，清理事件/动画/宿主；没有常驻空闲循环。Checklist仍由App持有问题，新增表单与搜索不改八事务计算。services/api-client为可注入fetch的独立适配层，services/index只读取公开base URL，未连接业务按钮；实际服务、权限与上传确认仍待实现。

## v0.29 共享视觉层

terminal-unity.css最后导入，共享钢蓝背景、冷银线条与文本token；首页/工作区外层/音乐使用同一个环境变量，工作阅读层保持浅底。它不复制业务或渲染器，不新增循环。Soundtrack.MusicEntry只在播放时显示曲名，窄桌面隐藏副标题；原单audio与音乐模式状态机继续负责生命周期。原12万余字节CSS仍有历史重叠，后续做共享工作区时合并，不把本轮样式覆盖当架构解耦已完成。

## v0.30 实际结构

首页由HomeTaskDirectory提供三条主入口，ToolDirectory在#/tools展示八工具；ExperienceWorkspace保留Three/工作区/单audio状态，新增独立AIAssistant原生dialog，覆盖时暂停事务渲染。工具目录/清单不再把find(page)=-1传给选中模型。

scene-pointer分别判断预览与前景动作；TaskArrayScene仅在按下与释放均属于已稳定前景的同一子选项时调用onAction，后排只选预览，无任意模型双击打开。慢速拖动按总位移判定，前景图内与工作区part文字均保留点击。

assistant-client只发用户对话与当前模块名，做结构白名单校验；assistant-gateway为Node中间件，服务端保管私有配置，固定DeepSeek端点，多轮工具调用经证据验证后使用现有wages/contracts规则。原表单无自动采集；App收到用户点击的action才向Salary/Contract传入一次apply请求或调用共享addQuestions。没有另一套业务计算或服务器对话数据库。

vite开发/预览、tools/serve生产构建预览、参赛包helper复用同一网关。服务只监听本机；公网多用户身份/额度隔离未做。terminal-unity已撤销v0.29深色主体覆盖，仅统一浅色音乐；assistant.css负责本轮新入口、目录与对话，不重画三维。

聊天由AIAssistant管理仅本次对话，AssistantEvidence memo化呈现实际规则重点和清单预览；不从模型散文提取数字。CSS消息动画只在新节点出现时运行，等待点仅请求中活动，无新Three或常驻JS循环。复制包含规则数字/问题；回复完成定位到最新答复开头。
