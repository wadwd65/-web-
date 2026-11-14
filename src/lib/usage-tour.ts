import type {WorkspacePage} from '../experience-modules.ts';

export type Step={id:string;title:string;text:string;hint:string;selectors?:string[];scene?:boolean;scrollTarget?:boolean;firstTarget?:boolean};
export function stepsFor(page:WorkspacePage,hasScene:boolean,view:'material'|'result'='material'):Step[]{
 const home:Step[]=[
  ...(hasScene?[{id:'scene',title:'先看看三维终端',text:'可以按住拖动，换个角度看看。点击露出的编号会切换预览，当前终端上的文字和子选项可以打开工具。',hint:'后排只预览，不会直接带你跳页',selectors:['.exhibit-webgl'],scene:true}]:[]),
  {id:'ask',title:'有问题，直接说',text:'把眼前的情况写在这里，不用先选类别，也不用一次说全。不清楚的地方，直接说“不知道”就好。',hint:'写好以后，再点“发送问题”',selectors:['.home-question-form']},
  {id:'tools',title:'想自己算，就打开工具',text:'工具列表里有工资、合同、Offer 对比等八项工具。不想聊天，也可以直接选一个使用。',hint:'只填已知信息，选填项可以后面再补',selectors:['.home-primary-navigation>button:nth-child(2)']},
  {id:'list',title:'要问的话，留在清单里',text:'需要问 HR、房东或办事窗口的事，可以整理到询问清单。之后再补答复，或把清单导出带走。',hint:'由你确认后保存，不会替你发给别人',selectors:['.home-primary-navigation>button:nth-child(3)']},
 ];
 const input:Record<string,{title:string;text:string;selectors:string[]}>= {
  offer:{title:'先放两份正常月薪',text:'两份正常税前月薪必填，其他条件按需补充。未知先留空，确认没有的开销才填 0。',selectors:['.offer-editors input[aria-label$="正常税前月薪"]']},
  contract:{title:'先放想核对的条款',text:'粘贴文字，并确认用工类型。只放一部分条款也可以，期限选填；照片识别与文件导入在下方。PDF目前只能预览。',selectors:['#contract-text','select[aria-label="用工类型"]']},
  salary:{title:'先填工资条里知道的金额',text:'应发工资必填。只填一部分也能整理已知金额；四项个人扣款齐全后才计算实发。扣款确认没有才填 0。',selectors:['.gross-field']},
  tax:{title:'先确认试算范围',text:'确认属于居民个人、本次只有限定工资薪金所得，再填写全年收入和已确认扣除。预缴税额选填，未知扣除不能直接填 0。',selectors:['.module-tax .tool-scope']},
  social:{title:'先选现在要办的事',text:'第一次工作、异地就医、换城市和社保卡各有不同路线。先选一件事，城市和险种可以稍后补。',selectors:['.module-social .scenario-selector']},
  rent:{title:'把要看的租房条款贴过来',text:'先贴原文，就能定位待核实的约定。费用选填，补齐月租、月数、押金及其他首次费用后才合计。',selectors:['#rent-text']},
  subsidy:{title:'先选城市和事项',text:'先查官方资料，再核实自己是否符合条件。其他城市目前可找求职住宿目录，不是全国现金补贴搜索。',selectors:['.policy-city-choices','.module-subsidy select']},
  leaving:{title:'不知道细节，也能先列清单',text:'离职情况全部选填，可以先列基础交接事项。确认关系、解除方式和去向后再细化，不自动替你确定法定离职日。',selectors:['.module-leaving .optional-fields>summary']},
 };
 const result:Record<string,{title:string;text:string;selectors:string[]}>= {
  offer:{title:'先看差额，再问关键条件',text:'这里先显示当前维度的差额。下方最多归并三件优先确认的事，完整条件与问题仍可展开；未知条件不会当成 0。',selectors:['.offer-overview']},
  contract:{title:'把问题对回原文',text:'核对只覆盖本次文字与确认值。展开一项可看原文、依据和可问HR的话，再由你决定是否加入询问清单。',selectors:['.review-summary']},
  salary:{title:'先看算出的金额和差额',text:'这里只用确认过的金额计算。实际到账选填；与计算不一致时先核实明细，不直接推断原因。',selectors:['.salary-verdict','.salary-partial','.output-machine']},
  tax:{title:'看清税额怎样组成',text:'下方能逐步查看公式和税率。预缴税额没填时，只看税额，不判断退补税；结果不替代正式申报。',selectors:['.module-tax .tool-metric']},
  social:{title:'每办一步，自己留下记录',text:'可以勾选和补备注。勾选只是你的台账，不代表机构已办结；改变事项时旧记录会先保留，确认后才新建。',selectors:['.module-social .route-timeline>li:first-child']},
  rent:{title:'费用和条款分开核实',text:'费用没填齐就保留未知，不凑总数。条款结果能定位原文、整理要问房东的问题；未定位不代表原件一定没有。',selectors:['.rent-total']},
  subsidy:{title:'先核对来源和适用范围',text:'查看资料中的地区、人群、公开时间和本次获取日期，再去官方入口核实。目录命中不代表你已符合或已获批。',selectors:['.policy-source-heading','.policy-evaluation']},
  leaving:{title:'办理过程，逐步记录',text:'核实一项再勾选，并记下沟通和回执。修改情况不会立即清掉旧清单，可以先下载；明确确认后才新建。',selectors:['.module-leaving .route-timeline>li:first-child']},
 };
 const detail=(view==='result'?result:input)[page];
 const work:Step[]=[
  page==='tools'?{id:'work',title:'选一件眼前要办的事',text:'八项工具都在这里，点“开始”就能用。不想先选工具，也可在上面的输入框直接说情况。',hint:'不用先登录，也不用先配置接口',selectors:['.tool-directory-list button:first-of-type'],scrollTarget:true,firstTarget:true}:
  page==='list'?{id:'work',title:'留好要问的事和答复',text:'可以自己添加问题，也能从工具整理过来。每项可以修改、记录答复，再按需导出。',hint:'引导不会清掉已有问题',selectors:['.checklist-item:first-child','.checklist-manual>summary'],scrollTarget:true,firstTarget:true}:
  {id:'work',title:detail?.title??'先填你知道的',text:detail?.text??'只填已知信息，不确定的先留空。',hint:'引导只介绍当前页，不会替你填写或提交',selectors:detail?.selectors,scrollTarget:true,firstTarget:page!=='contract'&&page!=='offer'},
  ...(!['home','tools','list'].includes(page)?[
   {id:'action',title:page==='subsidy'?'查询与保存入口在这里':'生成与下载入口在这里',text:page==='subsidy'?'选好事项后主动查询。取得资料后可保存带来源的记录，也可让AI帮助理解；引导不会替你联网查询。':'填写后，用这里的按钮生成结果；已有结果时可以下载。修改内容后需要重新处理，材料不会因为打开引导自动发送。',hint:'只介绍按钮，不会替你点击',selectors:page==='subsidy'?['.policy-result-actions','.policy-hub form button[type="submit"]','.task-action-strip']:['.tool-action','.task-action-strip'],scrollTarget:true,firstTarget:true},
   {id:'views',title:'想改内容，切回填写页',text:'填写和结果是同一件事的两个视图。先完成必要填写才能看结果；之后可以回来修改，再重新处理。',hint:'不用反复返回首页，也不用重新选工具',selectors:['.motion-work-nav'],scrollTarget:true},
  ]:[]),
  {id:'ask',title:'拿不准的时候，问 AI',text:'不用照着表格说话，直接讲你遇到的事。AI 会先解释，需要核对时再给出工具入口。',hint:'材料由你决定发送，结果也需要自己核对',selectors:['.assistant-header-entry']},
  {id:'home',title:'想回去，点左上角标志',text:'点击“初程”标志就能回到首页，本次填写会保留。不必找浏览器里的返回按钮。',hint:'工具列表也在顶部，可以继续选别的工具',selectors:['.experience-brand']},
 ];
 return [...(page==='home'?home:work),
  {id:'music',title:'切歌和播放器是两个入口',text:'点“切歌”会就地打开曲目列表，选中就能听。点“播放器”才会进入三维唱片界面，听音乐不影响工具里的填写。',hint:'音乐是可选的，随时可以暂停',selectors:['.music-entry']},
  {id:'help',title:'以后想再看，就点问号',text:'“查看引导”可以重看这段介绍；“你能做什么”保留功能范围、资料来源和使用限制。旁边的 API 设置可以连接自己的 DeepSeek，登录也是可选的。',hint:'不用先设置接口或登录，也可以开始体验',selectors:['.help-entry','.ai-settings-entry']},
 ];
}
