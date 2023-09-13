declare module '*.vue';

declare module 'vue' 
{
    export interface GlobalComponents 
    {
        TempVar: typeof import('vue-temp-var').default
    }
}

export {}