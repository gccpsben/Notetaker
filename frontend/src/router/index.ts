import { createRouter, createWebHistory } from 'vue-router'
import EditorView from '@/views/EditorView.vue';
import AuthView from '@/views/AuthView.vue';

const router = createRouter(
{
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: 
    [
        {
            path: '/',
            redirect: "editor"
        },
        {
            path: '/editor',
            name: 'editor',
            component: EditorView
        },
        {
            path: '/auth',
            name: 'auth',
            component: AuthView
        }
    ]
});

export default router
