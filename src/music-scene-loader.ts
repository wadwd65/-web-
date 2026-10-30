let pending:Promise<typeof import('./MusicArchiveScene.tsx')>|null=null;
export function loadMusicScene(){return pending??=(import('./MusicArchiveScene.tsx').catch(error=>{pending=null;throw error;}));}
export function warmMusicScene(){window.dispatchEvent(new Event('first-step:music-warm'));void loadMusicScene().then(module=>module.warmArchiveAsset()).catch(()=>{});}
