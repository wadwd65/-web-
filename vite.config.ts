import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {musicMiddleware} from './tools/music-source.mjs';
import {audioMiddleware} from './tools/audio-static.mjs';

const music={name:'official-theme-music',configureServer(server:any){server.middlewares.use((req:any,res:any,next:any)=>{if(!audioMiddleware(fileURLToPath(new URL('./public/',import.meta.url)),req,res)&&!musicMiddleware(req,res))next();});},configurePreviewServer(server:any){server.middlewares.use((req:any,res:any,next:any)=>{if(!musicMiddleware(req,res))next();});}};
export default defineConfig({ plugins: [react(),music], build: { sourcemap: false } });
