<script setup lang="ts">
import { useNavigator } from '@/composables/useNavigator';
import { useMainStore } from '@/stores/mainStore';
import { useNetworkStore } from '@/stores/networkStore';
import { MdEditor } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';
import { computed, nextTick, ref, VueElement, type Ref, reactive } from 'vue';
import { type APIOpenNoteResponseType, type FileObjectType } from '@/types';
import sanitizeHtml from 'sanitize-html';
import jsdom from 'jsdom';
</script>

<script lang="ts">

export class Notice
{
    // We need to use ref so that the Vue engine will update when we change content and opacity
    public content = ref("");
    public noticeOpacity = ref(1) as Ref<number>;

    public constructor(content:string) { this.content.value = content; }
    public fade(timeoutMs: number) 
    {
        let self = this;
        let timer = setInterval(() => 
        {
            let delta = 100 / timeoutMs;
            self.noticeOpacity.value = Math.max(0, this.noticeOpacity.value - delta);
            if (this.noticeOpacity.value == 0) clearInterval(timer);
        }, 100);
    }
}

export class OpenedTab
{
    public fullFilePath = "";
    public isLoading = false;
    public fileName = "";
    public networkStore = useNetworkStore();
    public content = "";
    public hasUnsavedChange = false;
    public editor = undefined as InstanceType<typeof MdEditor>|undefined;
    public isActive = false;

    public constructor(filePath:string)
    {
        if (filePath.endsWith("/")) throw new Error("File path must not end with '/'.");
        let self = this;
        this.fullFilePath = filePath;
        this.fileName = this.fullFilePath?.split("/").slice(-1)[0] ?? "";
    }

    public async load(onloadCallback?: (tab:OpenedTab) => void)
    {
        this.isLoading = true;
        this.networkStore.authGet(`/api/openNote?path=${this.fullFilePath}`)
        .then(data => 
        {
            this.content = data.content;
            // self.noteDoc = data as APIOpenNoteResponseType; 
            this.isLoading = false;
            nextTick(() => { if (onloadCallback) onloadCallback(this); });
        });
    }

    public async saveContent()
    {
        await this.networkStore.authPost(`/api/updateNote?path=${this.fullFilePath}`, { content: this.content });
        this.hasUnsavedChange = false;
    }   
}

export default
{
    mounted()
    {
        this.networkStore.connectSocket();
        this.openNote("/root/Crypto/Note Crypto");
    },
    data()
    {
        let data = 
        {
            networkStore: useNetworkStore(),
            navigator: useNavigator(),
            openedTabs: [] as OpenedTab[],
            notices: [] as Notice[],
            currentEditorContent: ""
        };
        return data;
    },
    methods:
    {
        openNote(fullPath:string) 
        { 
            // see if the file is already opened
            if (this.isFileOpened(fullPath))
            { 
                this.pushNotice("The file is already opened!", 5000);
                this.focusTab(fullPath); return; 
            }

            for (let openedTab of this.openedTabs) openedTab.isActive = false;
            let newTab = reactive(new OpenedTab(fullPath));
            // this.focusTab(newTab.fullFilePath);
            this.openedTabs.push( reactive(newTab) );
            newTab.isActive = true;
            newTab.load((tab) => 
            { 
                newTab.hasUnsavedChange = false; 
                newTab.content = tab.content;
                this.setContent(newTab, tab.content);
                this.focusTab(newTab.fullFilePath); 
                newTab.hasUnsavedChange = false;
            });
        },
        onFileClicked(file: FileObjectType)
        {
            if (file.type == 'Folder') this.navigator.goToFolder(file.objectName);
            else this.openNote(this.navigator.currentPath + file.objectName);
        },
        focusTab(fullPath:string)
        {
            let oldTab = this.activeTab;
            let oldTabUnsaved = oldTab?.hasUnsavedChange ?? true;

            let tab = this.openedTabs.find(x => x.fullFilePath == fullPath);
            if (tab == undefined) return;
            for (let openedTab of this.openedTabs) openedTab.isActive = false;
            tab.isActive = true;

            if (tab == undefined || oldTab == undefined) return;
            oldTab.hasUnsavedChange = oldTabUnsaved;
        },
        saveCurrentTab()
        {
            if (this.activeTab == undefined) return;
            if (this.activeTab.fileName == undefined) return;

            let fileNameOld = this.activeTab.fileName;

            let notice = this.pushNotice(`Saving ${fileNameOld}...`);

            this.activeTab.saveContent().then(() => 
            {
                notice.content.value = `Saved ${fileNameOld}!`;
                notice.fade(5000);
                setTimeout(() => { this.cleanupNotice() }, 10000); // Cleanup
            }).catch(() => 
            {
                notice.content.value = `Error saving ${fileNameOld}`;
                notice.fade(5000);
                setTimeout(() => { this.cleanupNotice() }, 10000); // Cleanup
            });
        },
        sanitizeOutputHTML(inputHtml:string)
        {   
            let allowedTags = 
            sanitizeHtml.defaults.allowedTags // all the default allowed tags (see https://www.npmjs.com/package/sanitize-html)
            .concat([ 'svg', 'img', 'path' ]) // equations uses SVG, and we would like to allow images as well
            .concat([ 'br', 'hr' ]) // we also want some styling tags
            .concat([ 'math', 'semantics', 'mrow', 'mi', 'mo', 'msqrt', 'msup', 'mn' ]); // used by katex

            let allowedAttr = 
            {
                '*': ['style', 'aria-hidden', 'language'], // we want to allow style on all tags
                'svg': ['xmlns', 'width', 'height', 'viewbox', 'preserveaspectratio'], // we need these to display equations and svg,
                'path': ['d']
            };

            let sanitizedHTML = sanitizeHtml(inputHtml, 
            {
                parseStyleAttributes: true,
                allowedClasses: { '*': ['*'] },
                allowedAttributes: allowedAttr,
                allowedTags: allowedTags
            });

            // Inject safe events (these events are not subject to XSS attacks, since we already sanitized the input being injecting events)
            // and the events are not based on user inputs.
            let dom = new DOMParser().parseFromString(sanitizedHTML, "text/html");
            dom.body.querySelectorAll(`.container_spoiler`).forEach(container => 
            {
                container.setAttribute("onclick", "this.classList.toggle(\"revealed\")");
            });

            return dom.body.innerHTML;
        },

        /**
         * Remove all notices that opacity equals to 0
         */
        cleanupNotice() 
        { 
            this.notices = this.notices.filter(x => (x.noticeOpacity as any) != 0); 
        },

        pushNotice(content:string, timeoutMs?: number)
        {
            let notice = new Notice(content);
            this.notices.push(notice as any);
            if (timeoutMs !== undefined) notice.fade(timeoutMs);
            setTimeout(() => { this.cleanupNotice() }, timeoutMs); // Cleanup
            return notice;
        },

        setContent(tab:OpenedTab, content:string)
        {
            if (tab == undefined) return;
            tab.content = content;
            tab.hasUnsavedChange = true;
        },

        isFileOpened(fullPath:string)
        {
            return this.openedTabs.find(tab => tab.fullFilePath == fullPath) != undefined;
        },

        closeTab(fullPath:string)
        {
            let tab = this.openedTabs.find(tab => tab.fullFilePath == fullPath);
            if (tab == undefined) return console.warn(`The tab \"${fullPath}\" is not found!"`);
            if (tab.hasUnsavedChange) 
            { 
                let promptMessage = `The file ${tab.fullFilePath} has unsaved changes, do you still want to close the file?`;
                if (!confirm(promptMessage)) return; 
            }
            this.openedTabs = this.openedTabs.filter(tab => tab.fullFilePath != fullPath);
        },

        onPreviewChanges()
        {
            // When the preview changes, we need to add spoiler events to the elements
            // we should not inject the onclick events via plugin, before the HTML will get sanitized and the onclick event will be cleared.
            // that's why we need to inject the events AFTER the html is sanitized.

            // let previewContainer = document.querySelector("article#md-editor-v3-preview");
            // if (previewContainer == undefined) return;
            // let allSpoilersContainer = previewContainer.querySelectorAll(".container_spoiler");
            // allSpoilersContainer.forEach(spoiler => 
            // {
            //     console.log(`Added to`);
            //     console.log(spoiler);
            //     spoiler.innerHTML += `123123`;
            //     (spoiler as HTMLElement).addEventListener('mousedown', () => 
            //     {
            //         console.log("clicked");
            //         alert("123123");
            //     });
            // });
        }
    },
    computed:
    {
        activeTab(): OpenedTab|undefined { return this.openedTabs.find(x => x.isActive); },
        unsavedTabPaths() 
        {
            let result = this.openedTabs.filter(x => x.hasUnsavedChange).map(x => x.fullFilePath);
            console.log(result);
            return result;
        }
    },
    watch:
    {
        // activeTab: 
        // {
        //     handler(newVal:OpenedTab, oldVal:OpenedTab) { this.currentEditorContent = newVal.noteDoc?.content ?? ""; },
        //     deep:true
        // },
        // currentEditorContent: function (newVal)
        // {
        //     if (this.activeTab?.noteDoc == undefined) return;
        //     this.activeTab.noteDoc.content = newVal;
        //     // if (this.activeTab.noteDoc.content == newVal) return;
        //     this.activeTab.hasUnsavedChange = true;
        // }
    }
}
</script>

<template>
    <!-- <button @click="mainStore.logout()">Logout</button> -->
    <grid-shortcut columns="minmax(15vw, 300px) 1fr" rows="1fr" class="fullSize" id="topDiv">
        <grid-shortcut columns='1fr' rows="40px 1fr 25px 25px" id="leftBar">
            <grid-shortcut id="leftBarTop" columns="40px auto 40px">
                <span :class="{'disabled': navigator.isRoot()}"
                class="center option" @click="navigator.goToParent">
                    <span style="font-size:20px;"
                    class="material-symbols-outlined icon">chevron_left</span>
                </span>
                <div class="center"><span>{{ navigator.currentFolderName }}</span></div>
                <span class="center option">
                    <span style="font-size:16px;"
                    class="material-symbols-outlined icon">settings</span>
                </span>
            </grid-shortcut>

            <div id="directoryStackPanel">
                <div id="directoryloadingCircle" v-if="navigator.isLoading">
                    <img class="loadingSpinner" src="@/assets/loadingIcon.png">
                </div>
                <div :class="{'disabled': navigator.isLoading, 'opened': isFileOpened(navigator.currentPath + file.objectName)}" 
                v-for="file in navigator.pathFiles" @click="onFileClicked(file)">
                    <div class="fileName">{{ file.objectName }}</div>
                    <div class="fileIcon">
                        <span class="material-symbols-outlined icon" v-if="file.type == 'Folder'">chevron_right</span>
                    </div>
                </div>
            </div>
        </grid-shortcut>
        <grid-shortcut colums='1fr' rows="40px 1fr 30px">
            <div id="tabsBar">
                <div v-for="tab in openedTabs" :class="{'active': activeTab?.fullFilePath == tab.fullFilePath}"
                class="tab" @click="focusTab(tab.fullFilePath)">
                    <div class="tabInnerGrid">
                        <div class="fileTitle">{{ tab.fileName }}</div>
                        <div class="filePath">{{ tab.fullFilePath }}</div>
                    </div>
                    <div class="tabCloseButton" @click="closeTab(tab.fullFilePath)">
                        <span class="material-symbols-outlined icon" v-if="unsavedTabPaths.includes(tab.fullFilePath)">radio_button_checked</span>
                        <span class="material-symbols-outlined icon" v-else>close</span>
                    </div>
                </div>
            </div>
            <div id="contentArea" style="position: relative;">
                <div v-for="tab in openedTabs.filter(tab => tab.isActive)" :key="tab.fullFilePath" :class="{'fullSize': tab.isLoading}">
                    <div v-if="tab.isLoading" class="fullSize center">
                        <img class="loadingSpinner" src="@/assets/loadingIcon.png">
                    </div>
                    <MdEditor :ref="tab.fullFilePath" v-if="tab.isActive && !tab.isLoading" theme="dark" 
                        class="fullHeight fullSizeAbs noBorder" language="en-US" :onOnHtmlChanged="onPreviewChanges"
                        @onSave="saveCurrentTab()" :sanitize="sanitizeOutputHTML" :modelValue="tab.content" :onChange="x => setContent(tab, x)"></MdEditor>
                </div>
                <div id="noticesOverlay">
                    <div class="notice" v-for="notice in notices" :key="notice.content">
                        <div :style="{'opacity': notice.noticeOpacity}">{{ notice.content }}</div>
                    </div>
                </div>
            </div>
        </grid-shortcut>
    </grid-shortcut>
</template>

<style lang="less" scoped>
@import "@/stylesheets/globalStyle.less";
@import "@/stylesheets/mainTheme.less";

#topDiv
{   
    background: @background;
    .disabled { opacity: 0.3; pointer-events: none; }

    #leftBar
    {
        background:@background;
        border-right: 1px solid @border;

        #leftBarTop 
        {             
            border-bottom: 1px solid @border;
            .option 
            { 
                .clickable; transition: all 0.1s ease;
                &:hover { background:@surfaceHigh; }
            }
        }

        #directoryStackPanel
        {
            display:flex; flex-direction: column; padding-top:3px; position:relative;
            #directoryloadingCircle { .fullSize; .center; .text; position: absolute; }

            & > div:not(#directoryloadingCircle)
            { 
                height:35px; .fullWidth; .text; cursor: pointer; padding-left: 10px;
                font-size:14px; transition: all 0.1s ease;
                display:grid; grid-template-columns: 1fr 35px; grid-template-rows: 1fr;

                &.opened { color:@focus !important; font-weight:bold; }
                &:hover { background:@surfaceHigh; } .fileName { .yCenter; } 
                .fileIcon 
                { 
                    span { font-size: 20px; }
                    .center;
                }
            }
        }
    }

    #tabsBar
    {
        background:@background; display:flex;
        border-bottom: 1px solid @border;
        
        .tab
        {
            display:grid; grid-template-columns: auto auto; grid-template-rows: 1fr;
            .yCenter; padding-left: 15px; height:100%; border-right: 1px solid @border;
            width: fit-content;

            .tabInnerGrid
            { 
                width:fit-content; height:min-content;
                display:grid; grid-template-columns: 1fr; grid-template-rows: auto auto;

                .fileTitle { .text; font-size:12px; .tight; height:fit-content; }
                .filePath { .text; font-size:8px; .tight; height:fit-content; }
            }

            .tabCloseButton 
            { 
                .text; .center; .horiPadding(15px); transition: all 0.1s ease;
                &:hover { color:@error !important; cursor:pointer; }
                span { font-size:14px; }
            }

            &.active { background:@surface; border-bottom:1px solid @focus; }
            &:hover { background: @surfaceHigh; cursor:pointer; }
        }
    }

    #contentArea
    {
        #noticesOverlay
        {
            .fullSizeAbs; display:flex; flex-direction: column-reverse;
            padding-bottom:45px; pointer-events: none;

            .notice 
            {
                .fullWidth; .center; margin-bottom: 5px;

                & > div 
                {
                    .text; font-weight: bold; color:white; font-size:14px;
                    padding:10px; background:fade(@blue,10%); width:fit-content; height:fit-content;
                }
            }   
        }
    }
}

</style>