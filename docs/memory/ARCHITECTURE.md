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

## v0.31 渲染开销职责

scene/style-writer以WeakMap保存实际赋值，规避CSSOM读回规范化；DOM样式仍仅由场景写入对应属性。TaskArrayScene按尺寸/分段共享几何，释放去重；固定静态局部矩阵但保留所有运动节点与镜头更新，每帧一次场景世界矩阵遍历。射线只排除不可见分支并复用数组，前景手势策略未放宽。15个脉冲共用InstancedMesh，轨迹/大小/颜色不变。

scene/deferred-asset区分字节prefetch与parse/load；music-scene-loader仅预取，不再广播隐藏场景挂载。MusicPlayer在实际present时才创建，之后按旧状态机保留/暂停；实际GLB只解析一次并允许失败重试。未改业务、AI或单audio；未实现自动降级。

## v0.32 模式与受限AI流程

App/八业务和ExperienceWorkspace继续常驻；mode只改变视觉层/布局，Scene与ArchiveScene在simple条件下不挂载。MusicEntry禁用预热，轻量播放器不创建盘面缩略图/频谱；唯一audio仍在同一父层。runtime-mode是可测试的有效帧检测和模式控制器，useExperienceMode只是React绑定；onFrame由原两渲染循环提供，无额外持续RAF。SceneBoundary拦截lazy场景失败，业务仍可达。减少动态与简易模式分别表达。

assistant-guide共用结构验证和安全提示，plan_tasks为强制第一步；非ready返回guide提示且无执行动作，ready继续有限Function Calling。AssistantNextStep呈现最多3候选/补问、选择与纠正；只有最新assistant回复的动作可应用，所有表单仍需显式点击。money evidence数组逐段来自user原话，最新未知/撤回不复用旧值。合同只读参考属于本地核验，不是RAG。在线合成评测脚本独立，不发送真实材料。

## v0.35 资料层
contract-knowledge.ts固定官方八摘录及元数据，共用纯函数检索。网关plan_tasks确认合同后检索，真实tool结果携带命中片段。一般说明只生成解释，白名单open_tool补真实入口；review仍共用旧规则。ContractSources在聊天/手动核对展开，client逐项验证已知摘录，模型URL不可作为引用。标记guide的范围提示与模型解释区分。来源复制/导出可回查。无新增依赖或逐帧工作。

## v0.35.1 对话通道
AIAssistant输入常驻，删除freeReply/hasFields门控与补问自动聚焦。AssistantNextStep仅提供可选字段/多事项快捷回复，ready无重复面板。guideReply用实际问题生成自然语言补问，复用工资字段证据定位识别已说明未知的项目。一般guidance先回答，明确导航请求保留open_tool。快捷操作保留未发送草稿，单独规划步骤不显示为处理过程。

## v0.35.2 本地布局

conversation-layout.css最后导入，集中覆盖工具目录和助手呈现。AIAssistant仍使用原生dialog、同一send/上下文/账户隔离生命周期；没有新路由或后台存储。ToolDirectory通过onAsk(text)把用户明确发送的文字交给ExperienceWorkspace.ask，后者复用共享助手。tools时暂停隐藏Scene并将活动采样设null。最终保存版/完整模式QA待做。

## v0.36 清单依据

lib/checklist.ts共用Question/QuestionDraft及可选合同证据类型、持久化校验、同次去重和导出。只保存用户点击加入时的真实子串（最多600字）与字符起点，官方资料使用已知摘录ID，读取时不按新问题重新猜依据。不同reviewId分别保留，改写不覆盖原始问题。QuestionEvidence与ContractSources复用阅读组件。Account服务验证新增可选字段，保留旧行；请求上限1MiB覆盖50条含答复/片段的合法记录。私有数据库位置仍在工程外。

## v0.37 主动草稿

lib/drafts.ts提供九模块的版本/字段验证、每账号/模块存储键和旧值校验。DraftControls负责显式读写、恢复和一次撤销，成功提示短暂保留，失败不隐去；解析用memo，无常驻循环。各原组件仅绑定当前输入与恢复回调，金额/合同结果清空再处理，社保/离职重建原导航并带回个人记录。聊天把现有规则/来源转成可读历史，只恢复role/content和未发送输入，使用负编号避免与新消息冲突，所有动作均需新回复再执行。AccountProvider新增身份就绪状态/查询序列，App在账号变化时清当前工具/对话。没有草稿上传接口或原图持久化。

## v0.38 检索查询与失败恢复

contractQueryFromMessages只构造检索主题查询，不改原用户证据。短追问须完整匹配，最近三条用户消息只允许单主题；换题/多主题/其他事项停止借用。searchContractKnowledge补口语及明确主题排序，原条文、适用范围、时效和显式条号优先保持。网关仍以原conversation.userText作事实校验。

ContractImage新增onUseText回调，仅关闭图片区、聚焦原textarea，不改原文/期限/用工确认。图片识别端为缺少warnings的无法辨认标记加人工校对提示。无效guidance+needs-info返回明确纠正信息；一般租房guidance先答，个人核对才补问。已观察的越界模型解释按原摘录回退为guide，边界规则不是完整语义校验。

## v0.39 初次访问与公开来源

App用visitedPages保留已访问工作区，NewModules过滤未访问工具；根表单不提前初始化。身份epoch仍重置工具和对话，并补清单输入重置。QuestionEditor只在value变化/聚焦/resize调整高度。TaskArrayScene直接toArray到现有Float32Array。

性能记录仅?perf=1创建，observer接生产控制器有效窗口及原因，300窗口/200事件、手动本机JSON下载。诊断模式下手动完整也可继续记录窗口，仍尊重手动选择；普通模式无observer保持原自动策略。暂停不记0FPS，内容和账号不进入报告。

request-policy.mjs在AI/图片/账号共用；PUBLIC_ORIGIN从进程环境选择一个HTTPS来源，Host精确匹配，公开POST须同Origin；不信任转发头。serve支持PORT/HOST，0.0.0.0需公开来源；代理账号Cookie始终Secure，公开指纹JS/CSS长缓存、HTML no-store。实际HTTPS终止/持久盘由部署平台提供，公平用户额度仍待。

## v0.40 布局层职责

首页DOM仅将原表单移至home-command-dock；home-layout.css限定首页位置/间距/字号。业务提交、三维场景、音乐和后台维持v0.39。左侧纵向入口/底部输入覆盖完整与简易；简易原步骤说明右上放置。承载轨道、黄金图形和蓝雾候选已撤回，不属于当前架构。
