/** Complete theme mark with a generous viewBox; shared by the header and entry. */
export const RHINE_SYMBOL_PATHS=[
 'M36 22C29 11 24 6 17 6C9 6 4 13 4 22C4 31 9 38 17 38C25 38 30 31 36 22C42 13 47 6 55 6C63 6 68 13 68 22C68 31 63 38 55 38C48 38 43 33 36 22Z',
 'M12 22H24M18 16V28M49 22H61'
] as const;
export default function RhineMark(){
  return <svg className="rhine-mark" viewBox="0 0 72 44" fill="none" aria-hidden="true">
    {RHINE_SYMBOL_PATHS.map(path=><path key={path} d={path}/>)}
  </svg>;
}
