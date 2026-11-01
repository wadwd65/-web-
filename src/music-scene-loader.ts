let pending:Promise<typeof import('./MusicArchiveScene.tsx')>|null=null;
export function loadMusicScene(){return pending??=(import('./MusicArchiveScene.tsx').catch(error=>{pending=null;throw error;}));}
export function warmMusicScene(){void loadMusicScene().then(module=>module.prefetchArchiveAsset()).catch(()=>{});}
