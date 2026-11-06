import {createCityPolicyMiddleware} from './tools/city-policy-service.mjs';
import {createAccountMiddleware} from './tools/account-service.mjs';
import {createImageMiddleware} from './tools/contract-image.mjs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {musicMiddleware} from './tools/music-source.mjs';
import {audioMiddleware} from './tools/audio-static.mjs';
import {createAssistantMiddleware} from './tools/assistant-gateway.mjs';

const directory=fileURLToPath(new URL('./',import.meta.url));
const music={name:'first-step-local-services',configureServer(server:any){const policies=createCityPolicyMiddleware(),assistant=createAssistantMiddleware({directory}),account=createAccountMiddleware(),image=createImageMiddleware({directory});server.middlewares.use((req:any,res:any,next:any)=>{if(!policies(req,res)&&!account(req,res)&&!image(req,res)&&!assistant(req,res)&&!audioMiddleware(fileURLToPath(new URL('./public/',import.meta.url)),req,res)&&!musicMiddleware(req,res))next();});},configurePreviewServer(server:any){const policies=createCityPolicyMiddleware(),assistant=createAssistantMiddleware({directory}),account=createAccountMiddleware(),image=createImageMiddleware({directory});server.middlewares.use((req:any,res:any,next:any)=>{if(!policies(req,res)&&!account(req,res)&&!image(req,res)&&!assistant(req,res)&&!musicMiddleware(req,res))next();});}};
export default defineConfig({ plugins: [react(),music], build: { sourcemap: false } });
