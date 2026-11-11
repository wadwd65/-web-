import {createUsageGuard,createUsageMiddleware} from './usage-service.mjs';
import {createAISettings} from './ai-settings.mjs';
import {createRequestPolicy} from './request-policy.mjs';
import {createAccountMiddleware} from './account-service.mjs';
import {createAssistantMiddleware} from './assistant-gateway.mjs';
import {createImageMiddleware} from './contract-image.mjs';
import {createCityPolicyMiddleware} from './city-policy-service.mjs';
export function createLocalServices({directory,policy=createRequestPolicy(),usage:provided,accounts,config,fetcher,settingsFetcher,limits,usageFile,now}={}){
 const usage=provided??createUsageGuard({accounts,...(now?{now}:{}),...(limits?{limits}:{}),...(usageFile?{file:usageFile}:{})});
 const credentials=createAISettings({directory,usage,policy,config,fetcher:settingsFetcher,...(now?{now}:{})});
 const entries=[credentials.middleware,createUsageMiddleware({usage,credentials,policy}),createCityPolicyMiddleware({policy}),createAccountMiddleware({store:accounts,policy}),createImageMiddleware({directory,config,fetcher,usage,credentials,policy}),createAssistantMiddleware({directory,config,fetcher,usage,credentials,policy})];
 return {handle:(req,res)=>entries.some(entry=>entry(req,res)),close(){credentials.close();if(!provided)usage.close();}};
}
