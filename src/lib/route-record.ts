export type RouteMarks=Record<string,boolean>;
export type RouteNotes=Record<string,string>;
export type RouteDraft<F>={form:F;generated:boolean;recordForm?:F|null;done:RouteMarks;notes:RouteNotes};
export type RouteRecord<F>=RouteDraft<F>&{recordForm:F|null;confirming:boolean;revision:number};
export type RouteAction<F>=
  |{type:'edit';form:F}|{type:'generate'}|{type:'replace'}|{type:'cancel'}|{type:'undo-edit'}
  |{type:'restore';draft:RouteDraft<F>}|{type:'done';value:RouteMarks}|{type:'notes';value:RouteNotes};

export function sameRouteForm<F>(left:F|null,right:F):boolean{return left!==null&&JSON.stringify(left)===JSON.stringify(right);}
export function hasRouteRecords(record:{done:RouteMarks;notes:RouteNotes}):boolean{return Object.values(record.done).some(Boolean)||Object.values(record.notes).some(note=>note.trim().length>0);}
export function legacyRouteRecordText(done:RouteMarks,notes:RouteNotes):string{
  return ['初程 · 旧格式办理记录','这份旧草稿没有保存生成清单时的情况，无法还原原路线。下面仅备份原有标记与备注，不作为新事项的办理结果。','',
    ...[...new Set([...Object.keys(done),...Object.keys(notes)])].map(id=>`${id} · ${done[id]?'已标记完成':'未标记完成'}\n备注：${notes[id]||'未填写'}`)].join('\n');
}
export function newRouteRecord<F>(form:F):RouteRecord<F>{return {form,recordForm:null,generated:false,done:{},notes:{},confirming:false,revision:0};}

/** Keep the last generated case separate from edits. Only explicit replacement may erase its records. */
export function routeRecordReducer<F>(state:RouteRecord<F>,action:RouteAction<F>):RouteRecord<F>{
  switch(action.type){
    case 'edit':return {...state,form:action.form,confirming:false};
    case 'done':return {...state,done:action.value};
    case 'notes':return {...state,notes:action.value};
    case 'cancel':return {...state,confirming:false};
    case 'undo-edit':return state.recordForm?{...state,form:state.recordForm,confirming:false}:state;
    case 'restore':return {...action.draft,recordForm:action.draft.recordForm??(action.draft.generated?action.draft.form:null),confirming:false,revision:state.revision+1};
    case 'generate':
      if(sameRouteForm(state.recordForm,state.form))return {...state,confirming:false,revision:state.revision+1};
      if(hasRouteRecords(state))return {...state,confirming:true};
      return {...state,recordForm:state.form,generated:true,done:{},notes:{},confirming:false,revision:state.revision+1};
    case 'replace':
      if(!state.confirming)return state;
      return {...state,recordForm:state.form,generated:true,done:{},notes:{},confirming:false,revision:state.revision+1};
  }
}
