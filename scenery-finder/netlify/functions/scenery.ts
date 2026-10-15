import worker from '../../worker/index.js';
export default async (request:Request) => worker.fetch(request, {ZHIPU_API_KEY:Netlify.env.get('ZHIPU_API_KEY'),AMAP_API_KEY:Netlify.env.get('AMAP_API_KEY'),ZHIPU_MODEL:Netlify.env.get('ZHIPU_MODEL')});
export const config={path:'/api/*'};
