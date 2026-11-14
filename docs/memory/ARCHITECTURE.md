# v0.49.10 当前架构

|职责|代码入口|边界|
|---|---|---|
|路由、八工具、共享清单|App.tsx、Salary.tsx、NewModules.tsx、PolicyHub.tsx|首次访问挂载，访问后保留；身份变化清当前状态|
|工作区与模式|ExperienceWorkspace.tsx、useExperienceMode.ts、runtime-mode.ts|完整/简易共用业务，不复制规则或audio|
|业务三维与手势|TaskArrayScene.tsx、scene-pointer.ts、scene-actions.ts|稳定前景子项可执行，后排仅预览|
|音乐|Soundtrack.tsx、MusicPlayer.tsx、MusicArchiveScene.tsx、music-mode.ts|单audio、可逆转场状态机、抽取与旋转|
|入场与鼠标|ExperienceEntry.tsx、entry-sequence.ts、PointerFeedback.tsx|等待主动开始，可见时间时钟、回放、池化反馈|
|规则与证据|src/lib/|金额整数分、未知状态、原文/依据/快照及清单|
|真实对话|AIAssistant.tsx、src/services/assistant-*、tools/assistant-gateway.mjs|有限规划/工具，用户显式应用，不采集已有表单|
|合同图像与资料|ContractImage.tsx、ContractSources.tsx、contract-knowledge.ts、tools/contract-image.mjs|单图发送校对，小范围官方摘录，PDF仅预览|
|城市政策|PolicyHub.tsx、PolicySources.tsx、city-policies.ts、tools/city-policy-service.mjs|有限卡片与固定官方住宿目录，外部来源当不可信数据|
|账号与草稿|Account.tsx、DraftControls.tsx、lib/drafts.ts、tools/account-service.mjs|可选/主动保存，本机草稿按身份隔离，不存原图|
|接口与额度|AISettings.tsx、AIUsageHint.tsx、tools/ai-settings.mjs、usage-service.mjs|临时Key在RAM，工程外SQLite限额/短租约，无轮询|
|统一服务|tools/local-services.mjs、serve.mjs、vite.config.ts|开发/预览/保存版共用，精确Host/Origin，不开放任意代理|

Three 复用几何和资源，抑制重复DOM赋值；简易卸载重场景。控制器阈值只经模拟，低配实机仍待。CSS仍有历史叠加，不借文件整理擅自重构视觉。

私有配置/数据库不得进入构建、快照或日志。QA用localhost与正式127.0.0.1分开，端口不能隔离Cookie。公网HTTPS、代理及重启在用户部署后验收。

音乐重复不透明壳体和共用盘芯由scene/archive-batch.ts合批，原节点保留拾取/标识；可见实例紧凑提交，稳定矩阵不重复上传。archive-motion区分enter/return/browse，列表预览不触发retarget，收盘与后排显隐先于/晚于空间行进，0493详情浏览时序见下文，原49为业务基线。阴影行进期间隐藏且不重绘，到位后按新可见集合刷新再淡入。archiveLayers保持可见盖与盘的Z间距。

scene/render-cadence.ts在0495使用原生显示回调；刷新率估计只用于诊断，不分频、不伪造帧。低配的单帧预算仍须目标机测量。音乐异步预编译使用disposeAfterPreparation，卸载先拆监听/DOM，等编译停止后释放GPU。

0493：archive-batch保留原材质，活动整匣直接从原层级绘制，停放阵列仍合批，切换是单帧互斥交接。普通/实例材质不共享程序状态，克隆复制onBeforeCompile和customProgramCacheKey。准备阶段覆盖两条绘制路径并实际首绘，所有盘面在onReady前上传。archive-motion统一空间常量、整匣分阶段时序和可见时间；browse不再中途retarget，出场整匣回深处并整体缩小，入场到位后才开盘。50ms动画步长上限只防悬挂后跳过中间姿态，不改性能采样值。临时Canvas截图代码已经移除，正常运行不做toDataURL。


0494覆盖上述0493的逐层Alpha退隐与scale缩点：scene/archive-coverage在原shader后加统一屏幕像素覆盖率，实心层保留原透明性/深度写入，batch fade与非合批细节使用同一遮罩；覆盖率通过uniform更新，静置批次/活动原层级仍互斥。旧详情整匣退至深处，真实透视缩小并保留到新整匣遮住。临时视频采集只在独立QA代理，运行代码无MediaRecorder/captureStream及录制网络请求。


0495：transform-writer以精确TRS缓存局部矩阵，静止节点不强制整棵树更新，父子世界矩阵仍由Three传播。首页缓存不变材质透明度/投影标志；音乐静置批次只在姿态/显隐切换时更新，详情隐藏演员不做可见工作但保留播放角度，零透明描边不提交。DPR/灯光/材质/几何/粒子与49.4相同；临时GPU查询及录像不进入正式代码。


0496恢复三处业务证据过滤：salaryFact忽略纯任务动词和明确不变引用，confirmedDuration忽略无新月数的期内/期满时间状语但保留撤回；locate不从未拍入/缺失说明或样张标题定位条款。evaluate-frozen-benchmark复用锁定合成集，独立报告不覆盖，正常应用不运行评测。所有49.5三维/性能和单audio路径保持。


0498—0499：音乐阴影由archive-shadow的单批次柔和近似投影按实际世界姿态更新，取消音乐PCF深度pass；首页阴影保持。archive-drag拥有逐唱片目标姿态与单pointer手势，MusicArchiveScene阻尼各自姿态，抓取期间冻结镜头/邻片hover偏移。转场先清手势、捕获已渲染整匣姿态，再清手动偏角，原archive-motion/遮罩/合批互斥路径保留。诊断中的recordPoses/cameraPose仅perf=1写入，正常页面不新增逐帧DOM探针。


04910：简易首页的共用导航移入home-start-column常规流，完整模式footer保留原位置；首页scopeShadowReceiver只裁地面光栅矩形，PCF/阴影图/周期不变，捕获与原深度图同姿态的投影边界，draw后恢复scissor；近裁面不安全时回退全窗口。perf=1的performance-audit显式保留少量适配器/画布/帧耗纯数据供PerformanceDiagnostics导出，卸载清context引用，普通会话不读取硬件。临时GPU timer/录像/像素对照在系统Temp，正式构建无这些工具。

04914：conversation-tone仅识别普通交流/使用说明，runAssistant该路径真实模型tools=[]且不返回guide；混合事项走原证据规划。AISettings.configuration附带服务端usageMode，usage个人模式只保留minute组与lease、不写三层daily；usage状态个人字段null/provider-billed，过期available=false。聊天和识图中间件共用此可信模式，body不可信；AIUsageHint/API设置同步说明。Key仍约1h RAM，默认计数切回不清零。

04915：MusicBackdrop仅mode.present且非lightweight挂载，用实际state.index、固定scene profile和原图片路径；DOM仅保留两层/单timeout，转场途中接续最新requested，不做每帧state。createMusicAtmosphere改用p.current，与背景同一曲目来源。图库reveal/hover仍只预览模型。新样式限定.music-console，未写根主题变量。

04916：music-atmosphere-blend无分配更新from/to/mix，最多两模式并在当前段完成后接最新current；MUSIC_ATMOSPHERE_FADE_MS供DOM和GPU共用。music-atmosphere的w(n)按离散ID取权重，取消uMode编号连续插值；创建时latest.current.current初始化。reduced立即落位。原图片/模型/业务/单audio保持。

050：WorkspaceViewContext让业务页操作文案与当前材料/结果视图一致。DraftControls compact复用同一保存逻辑，三个核心工具仅保留步骤导航+标题工具组+当前操作。PointerFeedback控件态抑制中心点和sparks，保留池化单rAF，不新建常驻动画。AIAssistant在ExperienceWorkspace常驻，状态/用量读取不以对话可见性为取消边界；chat仅显式停止或身份卸载取消。

communication.ts的contextStart标记不发送给API，只切取当前确认条目之后的上下文；同样存入显式聊天草稿以防恢复时重新附带旧对话。CommunicationDraft先编辑并确认，seed.send=false，输入框主动发送才调用模型。PDF.js按需加载，版本锁定6.5.438，worker/CMaps作为本地资源并与上游哈希测试一致；PDF任务取消/结束destroy，文件变化使用pdf前缀key避免与图片key碰撞；原文字仅在人工确认后替换。四城目录增加overview及category，不扩大任意外站访问范围；校方通知仅白名单career.hznu.edu.cn，其他城市实时发现仍限既定官方驿站目录。
