import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Սա թույլ է տալիս կոդի մեջ օգտագործել process.env.API_KEY-ը
      // Vercel-ում կամ այլ հոսթինգում տեղադրելիս Environment Variable-ներից
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Եթե այլ փոփոխականներ պետք լինեն, կարող եք ավելացնել այստեղ
      'process.env': {} 
    }
  };
});