import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/postcss';
import {defineConfig} from 'vite';
export default defineConfig({root:path.resolve(import.meta.dirname,'netlify-app'),publicDir:path.resolve(import.meta.dirname,'public'),plugins:[react()],css:{postcss:{plugins:[tailwind()]}},resolve:{alias:{'@/lib/send-form':path.resolve(import.meta.dirname,'netlify-app/send-form.ts'),'@':path.resolve(import.meta.dirname)}},build:{outDir:path.resolve(import.meta.dirname,'netlify-dist'),emptyOutDir:true}});
