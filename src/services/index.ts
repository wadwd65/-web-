import {createFirstStepApi} from './api-client.ts';

// A public backend URL only. Authentication/model secrets stay on the server.
export const firstStepApi=createFirstStepApi({baseUrl:import.meta.env.VITE_API_BASE_URL??''});
export {FirstStepApiError} from './api-client.ts';
export type * from './api-types.ts';
