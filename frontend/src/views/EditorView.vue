<script setup lang="ts">
import { useNavigator } from '@/composables/useNavigator';
import { useNetworkStore } from '@/stores/networkStore';
import { MdEditor } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';
import { nextTick, ref, type Ref, reactive } from 'vue';
import { type FileObjectType } from '@/types';
import sanitizeHtml from 'sanitize-html';
import mathExp from 'math-expression-evaluator';
</script>

<script lang="ts">

export class Notice
{
    // We need to use ref so that the Vue engine will update when we change content and opacity
    public content = ref("");
    public noticeOpacity = ref(1) as Ref<number>;
    public noticeType = 'info' as 'info'|'error'|'warning';

    public constructor(content:string, type:'info'|'error'|'warning'='info') 
    { 
        this.content.value = content; 
        this.noticeType = type;
    }
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

export class QuickResult
{
    public type = 'text' as 'text'|'color';
    public arg: any;
    public constructor(type:'text'|'color'='text', arg?:any)
    {
        this.type = type;
        if (arg) this.arg = arg;
    }
}

/**
 * Represent a selectable item in the UI
 */
export abstract class Selectable 
{
    public abstract getType():string;    
}

export class FolderItem extends Selectable
{
    public fullPath = "";

    constructor(fullpath:string)
    {
        super();
        this.fullPath = fullpath;
    }

    public getType(): string { return "Folder" };
}

/**
 * Represent a folder (in which the navigator is showing).
 */
export class FolderNavigatorItem extends Selectable
{
    public fullPath = "";

    constructor(fullpath:string)
    {
        super();
        this.fullPath = fullpath;
    }

    public getType(): string { return "FolderNavigator" };
}

export class FileItem extends Selectable
{
    public fullPath = "";

    constructor(fullpath:string)
    {
        super();
        this.fullPath = fullpath;
    }

    public getType(): string { return "File" };
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

        document.addEventListener("mousemove", (e) => 
        {
            this.mouseLocation.x = e.clientX;
            this.mouseLocation.y = e.clientY;
        });

        document.addEventListener("selectionchange", (e) => 
        {
            let selection = window.getSelection();
            if (selection == undefined) return;
            let type = selection.type; // expect 'Range'

            if (type === 'Range') this.currentHighlightedText = selection.toString();
            else if (type === "Caret")
            {
                let anchorNode = selection.anchorNode;
                this.currentHighlightedText = (anchorNode as HTMLElement).innerText || anchorNode?.nodeValue || '';
            }
            else this.currentHighlightedText = '';
        });
    },
    data()
    {
        let data = 
        {
            networkStore: useNetworkStore(),
            navigator: useNavigator(),
            openedTabs: [] as OpenedTab[],
            notices: [] as Notice[],
            currentHighlightedText: "",
            mexp: new mathExp(),
            selectedItem: undefined as undefined|Selectable,
            mouseLocation: { x:0, y:0 },
            contextMenuLocation: { x:0, y:0 }
        };
        return data;
    },
    methods:
    {
        /**
         * Rename an object (either a folder or a file).
         * This method will prompt user to enter a new name.
         * @param filePath 
         */
        renameObject(filePath:string)
        {
            
        },
        updateContextMenuLocation() 
        { 
            this.contextMenuLocation.x = this.mouseLocation.x;
            this.contextMenuLocation.y = this.mouseLocation.y;
        },
        onDirectoryClicked(fullPath:string)
        {
            this.updateContextMenuLocation();
            alert(fullPath);
        },
        onDirectoryFileClicked(pathItem: FileObjectType)
        {
            this.updateContextMenuLocation();
            if (pathItem.type == 'Folder') this.selectedItem = new FolderItem(this.navigator.currentPath + pathItem.objectName + '/'); // A folder
            else this.selectedItem = new FileItem(this.navigator.currentPath + pathItem.objectName); // A file
        },
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

            this.activeTab.saveContent().then((data) => 
            {
                console.log(data);
                notice.content.value = `Saved ${fileNameOld}!`;
                notice.fade(5000);
                setTimeout(() => { this.cleanupNotice() }, 10000); // Cleanup
            })
            .catch(async (response: Response) => 
            {
                let body = await response.json();
                notice.noticeType = 'error';
                if (body) notice.content.value = `Error saving ${fileNameOld}: ${body.name}`;
                else notice.content.value = `Error saving ${fileNameOld}: ${response.status}(${response.statusText})`;
                notice.fade(15000);
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

        closeContextMenu() { this.selectedItem = undefined; },
    },
    computed:
    {
        activeTab(): OpenedTab|undefined { return this.openedTabs.find(x => x.isActive); },
        unsavedTabPaths() 
        {
            let result = this.openedTabs.filter(x => x.hasUnsavedChange).map(x => x.fullFilePath);
            console.log(result);
            return result;
        },
        quickResult(): QuickResult
        {
            // ft to meters
            if (/^[0-9.]{1,}[ ]{0,1}(ft)|(feets)|(feet)/i.test(this.currentHighlightedText))
            {
                let ft = parseFloat(this.currentHighlightedText.split(' ')[0]);
                let r = new QuickResult('text');
                r.arg = `${ft} feet = ${(ft * 0.3048).toFixed(2)} meter(s)`;
                return r;
            }
            else if (/^#[0-9a-f]{6}$/i.test(this.currentHighlightedText))
            {
                let hexToDec = (str:string) => { return parseInt(str, 16); }
                let hex = this.currentHighlightedText.replace("#",''); // 123456
                let rgb = `${hexToDec(hex[0]+hex[1])}, ${hexToDec(hex[2]+hex[3])}, ${hexToDec(hex[4]+hex[5])}`;
                return new QuickResult('color', { hex: hex, rgb: rgb });
            }

            // Users may input maths equations to get quick result: 
            // The selection must contains a single "=" at the start for the function to be activated
            else if (/^={1}[0-9.\(\)\&a-z\+\-\*\/ \,\^]+$/.test(this.currentHighlightedText))
            {
                let expression = this.currentHighlightedText.split("=")[1];
                try
                {
                    let result = this.mexp.eval(expression, [], {});
                    return new QuickResult('text', `${expression} = ${result}`);
                }
                catch(ex) { return new QuickResult('text', `Invalid Expression: ${expression}`); }
            }
            else return new QuickResult('text', this.currentHighlightedText);
        },
        selectedItemType(): string|undefined { return this.selectedItem?.getType(); }
    },
    watch:
    {
        
    }
}
</script>

<template>

    <div class="contextMenuContainer" v-if="selectedItem">
        <div v-fixed-pos="contextMenuLocation" class="contextMenu">
            <TempVar :define="{ 'itemType': selectedItem.getType() }" #defined="{itemType}">
                <div v-if="itemType == 'Folder'">
                    <div>Open</div>
                    <div>Rename</div>
                </div>
                <div v-if="itemType == 'File'">
                    <TempVar :define="{ 'fullPath': (selectedItem as FileItem).fullPath }" #defined="{fullPath}">
                        <div @click="openNote(fullPath); closeContextMenu();">Open</div>
                        <div @click="closeContextMenu(); renameObject(fullPath);">Rename</div>
                    </TempVar>
                </div>
            </TempVar>
        </div>
        <div class="contextBackdrop" @click="selectedItem = undefined"></div>
    </div>

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
                v-for="file in navigator.pathFiles" @click="onFileClicked(file)" 
                @contextmenu.prevent="onDirectoryFileClicked(file)">
                    <div class="fileName">{{ file.objectName }}</div>
                    <div class="fileIcon">
                        <span class="material-symbols-outlined icon" v-if="file.type == 'Folder'">chevron_right</span>
                    </div>
                </div>
                <div @contextmenu.prevent="onDirectoryClicked(navigator.currentPath)" class="directoryEmptyPart"></div>
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
            <div id="contentArea" class="rel">
                <div v-for="tab in openedTabs.filter(tab => tab.isActive)" :key="tab.fullFilePath" :class="{'fullSize': tab.isLoading}">
                    <div v-if="tab.isLoading" class="fullSize center">
                        <img class="loadingSpinner" src="@/assets/loadingIcon.png">
                    </div>
                    <MdEditor v-selection-changed :ref="tab.fullFilePath" v-if="tab.isActive && !tab.isLoading" theme="dark" :autoDetectCode="true"
                        class="fullHeight fullSizeAbs noBorder" language="en-US" :modelValue="tab.content"
                        @onSave="saveCurrentTab()" :sanitize="sanitizeOutputHTML" :onChange="x => setContent(tab, x)"></MdEditor>
                </div>
                <div id="noticesOverlay">
                    <div class="notice" :class="notice.noticeType" v-for="notice in notices" :key="notice.content">
                        <div :style="{'opacity': notice.noticeOpacity}">{{ notice.content }}</div>
                    </div>
                </div>
            </div>
            <div id="footerArea">
                <div v-if="quickResult.type == 'text'" class="text">{{ quickResult.arg }}</div>
                <div v-if="quickResult.type == 'color'" class="color">
                    <div class="description">#{{ quickResult.arg.hex }}, rgb({{ quickResult.arg.rgb }}):</div>
                    <div class="colorPreviewContainer">
                        <div :style="{'background': `#${quickResult.arg.hex}`}"></div>
                    </div>
                </div>
            </div>
        </grid-shortcut>
    </grid-shortcut>

</template>

<style lang="less" scoped>
@import "@/stylesheets/globalStyle.less";
@import "@/stylesheets/mainTheme.less";

.directoryEmptyPart 
{ 
    background: #01010101; width:100% !important; height:100% !important; 
    cursor:default !important;
    &:hover { background: #01010101 !important; }
}

.contextMenuContainer
{
    .fullSize; .fixed;
    z-index:100;

    & > div { .fixed; width:fit-content; }

    .contextBackdrop
    {
        .fullSize; .fixed; cursor:default !important;
        z-index: 101;
    }

    .contextMenu
    {
        position: fixed; z-index:102;
        border:1px solid @border;
        width:150px; height:fit-content; 
        min-height:100px; background:@backgroundDark;
        border-radius: 5px;
        box-shadow: 0px 0px 10px black;

        & > div > div
        {
            font-weight:bold;
            .text; padding:10px; .yCenter; cursor:pointer;
            font-size:14px; transition: all 0.1s ease-out;
            &:hover { background:@surface; }
        }
    }
}

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

                &.error > div { background:fade(@error,50%); color:brightness(@error, 50%); }
                &.info > div { background:fade(@blue,10%); }
                &.warning > div { background:fade(@yellow,10%); }

                & > div 
                {
                    .text; font-weight: bold; color:white; font-size:14px;
                    padding:10px; width:fit-content; height:fit-content;
                }
            }   
        }
    }

    .ellipsisContainer
    {
        overflow:hidden; display:flex;
        & > div { overflow:hidden; height:fit-content; white-space: nowrap; text-overflow:ellipsis; }
    }

    #footerArea
    {
        .ellipsisContainer; border-top: 1px solid @border; .text; .yCenter;
        padding-left:10px; font-size:12px; 
        
        & * { font-family: Consolas; }

        & .color
        {
            display:grid; grid-template-columns: auto 15px; grid-template-rows: 1fr; gap:5px;
            & .colorPreviewContainer 
            {
                height: 100%; .yCenter;
                & > div { width:10px; height:10px; } 
            }
        }
    }
}

</style>