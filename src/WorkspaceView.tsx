import {createContext,useContext} from 'react';

export const WorkspaceViewContext=createContext<'material'|'result'>('material');
export const useWorkspaceView=()=>useContext(WorkspaceViewContext);
