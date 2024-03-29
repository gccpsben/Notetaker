import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

// https://vitejs.dev/config/
export default defineConfig(
{
    plugins: [vue(), vueJsx()],
    resolve: 
    {
        alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
    },
    server:
    {
        proxy:
        {
            '/api': 
			{
				target: 'https://192.168.8.130:55558',
				changeOrigin: true,
				secure: false
			},
			'/socket.io': {
				target: 'https://192.168.8.130:55558',
				changeOrigin: true,
				ws: true,
				secure: false
			},
            // "/*": {
			// 	target: 'https://192.168.8.130:55559'
			// },
        }
    }
})
