import path from 'node:path';
import tailwind from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

export default defineConfig({
 root: path.resolve(__dirname,'netlify-app'),
 publicDir: path.resolve(__dirname,'public'),
 plugins:[react()],
 css:{postcss:{plugins:[tailwind()]}},
 resolve:{alias:{'@/lib/send-form':path.resolve(__dirname,'netlify-app/send-form.ts'),'@':path.resolve(__dirname)}},
 build:{outDir:path.resolve(__dirname,'netlify-dist'),emptyOutDir:true},
});
