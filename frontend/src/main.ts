import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import gridShortcutVue from 'snippets/vite-vue-ts/components/gridShortcut.vue';
import '@/stylesheets/editorTheme.less';
import { config } from 'md-editor-v3';
import namedCodeBlocks from 'markdown-it-named-code-blocks';
import markdownItContainer from 'markdown-it-container';
import vSelectionChanged from './directives/vSelectionChanged';
import vFixedPos from './directives/vFixedPos';
import TempVar from 'vue-temp-var';

let components = 
{
    "grid-shortcut": gridShortcutVue
};

const app = createApp(App)
let pinia = createPinia();
app.use(pinia);
app.use(router);
app.use(TempVar);
app.directive("selection-changed", vSelectionChanged);
app.directive("fixed-pos", vFixedPos);
Object.entries(components).forEach(component => { app.component(component[0], component[1]); });

config(
{
    markdownItConfig(mdit) 
    {
        mdit.use(namedCodeBlocks);

        /**
         * Usage: 
         * :::warning
         * content here
         * :::
         */
        mdit.use(markdownItContainer, "warning", 
        {
            render: function(tokens:any, idx:any)
            {
                let centerStyle = `style="display:grid; align-items:center; justify-content:center; padding-right:15px;"`;

                if (tokens[idx].type === "container_warning_open")
                {
                    return `
                        <div class="container_warning_grid" style="margin-bottom:15px;"> 
                            <div ${centerStyle}> 
                                <span class="material-symbols-outlined icon">warning</span>
                            </div>
                                <div>
                    `;
                }
                else if (tokens[idx].type === "container_warning_close") { return "</div> </div>"; }
            }
        });

        /**
         * Usage: 
         * :::info
         * content here
         * :::
         */
        mdit.use(markdownItContainer, "info", 
        {
            render: function(tokens:any, idx:any)
            {
                let centerStyle = `style="display:grid; align-items:center; justify-content:center; padding-right:15px;"`;

                if (tokens[idx].type === "container_info_open")
                {
                    return `
                        <div class="container_info_grid"> 
                            <div ${centerStyle}> 
                                <span class="material-symbols-outlined icon">info</span>
                            </div>
                                <div>
                    `;
                }
                else if (tokens[idx].type === "container_info_close") { return "</div> </div>"; }
            }
        });

        /**
         * Usage: 
         * :::spoiler
         * content here
         * :::
         */
        mdit.use(markdownItContainer, "spoiler", 
        {
            render: function(tokens:any, idx:any)
            {
                let centerStyle = ``; // style="filter:blur(5px); cursor:pointer;"

                if (tokens[idx].type === "container_spoiler_open")
                {
                    return `<div class="container_spoiler"> <div class="textContainer"> <div>SPOILER</div> </div> <div class="spoilerContent">`;
                }
                else if (tokens[idx].type === "container_spoiler_close") { return "</div> </div> </div>"; }
            }
        });
    }
});

app.mount('#app')
