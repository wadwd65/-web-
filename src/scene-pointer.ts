import type {SceneAction} from './scene-actions.ts';
export type ScenePress={pointerId:number;x:number;y:number;module:number|null;zone?:string;foreground?:boolean};
export type SceneRelease={pointerId:number;x:number;y:number;module:number|null;inside:boolean;zone?:string;action?:SceneAction|null};

/** Background objects may change the preview, but never execute their sub-actions. */
export function previewFromPress(press:ScenePress|null,release:SceneRelease,dragged:boolean,working:boolean):number|null{
 if(!press||working||dragged||!release.inside||press.pointerId!==release.pointerId)return null;
 if(Math.hypot(release.x-press.x,release.y-press.y)>6)return null;
 return press.module!==null&&press.module===release.module&&press.module>=0&&press.module<8?press.module:null;
}

/** A sub-option must belong to the foreground at both ends of a settled gesture. */
export function actionFromPress(press:ScenePress|null,release:SceneRelease,dragged:boolean,selected:number,settled:boolean):SceneAction|null{
 const module=previewFromPress(press,release,dragged,false);
 if(module===null||module!==selected||!press?.foreground||!settled||!press.zone||press.zone!==release.zone)return null;
 return release.action??null;
}
