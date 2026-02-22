
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    define: {
      // API Keys for Client Side
      'process.env.API_KEY': JSON.stringify("AIzaSyByy52PD7Ww7ycESNhtzt4He3kHBDTlyDc"),
      
      // Firebase Configuration
      'process.env.FIREBASE_API_KEY': JSON.stringify("AIzaSyBkLx7A2QGeQFfklSFyYg7PPDLTCbAMhzw"),
      'process.env.FIREBASE_AUTH_DOMAIN': JSON.stringify("timi-platform.firebaseapp.com"),
      'process.env.FIREBASE_PROJECT_ID': JSON.stringify("timi-platform"),
      'process.env.FIREBASE_STORAGE_BUCKET': JSON.stringify("timi-platform.firebasestorage.app"),
      'process.env.FIREBASE_MESSAGING_SENDER_ID': JSON.stringify("295502379181"),
      'process.env.FIREBASE_APP_ID': JSON.stringify("1:295502379181:web:11995f2cd1d0215f04ee24"),
    }
  };
});
