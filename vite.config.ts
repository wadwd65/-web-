import {createLocalServices} from './tools/local-services.mjs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {musicMiddleware} from './tools/music-source.mjs';
import {audioMiddleware} from './tools/audio-static.mjs';

const directory=fileURLToPath(new URL('./',import.meta.url));
const music={name:'first-step-local-services',configureServer(server:any){const services=createLocalServices({directory});server.httpServer?.once('close',()=>services.close());server.middlewares.use((req:any,res:any,next:any)=>{if(!services.handle(req,res)&&!audioMiddleware(fileURLToPath(new URL('./public/',import.meta.url)),req,res)&&!musicMiddleware(req,res))next();});},configurePreviewServer(server:any){const services=createLocalServices({directory});server.httpServer?.once('close',()=>services.close());server.middlewares.use((req:any,res:any,next:any)=>{if(!services.handle(req,res)&&!musicMiddleware(req,res))next();});}};
export default defineConfig({ plugins: [react(),music], build: { sourcemap: false } });
