<script setup lang="ts">
import { useNavigator } from '@/composables/useNavigator';
import { useNetworkStore } from '@/stores/networkStore';
import { MdEditor, type ExposeParam } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';
import { nextTick, ref, type Ref, reactive, computed } from 'vue';
import { type FileObjectType } from '@/types';
import sanitizeHtml from 'sanitize-html';
import mathExp from 'math-expression-evaluator';
import type { ComputedRef } from 'vue';
import { useMouse } from '@/composables/useMouse';
import { useNotices } from '@/composables/useNotices';
import { useUserSelection } from '@/composables/useUserSelection';
import { Selectable, useContextMenu } from '@/composables/useContextMenu';
import { useLaggingRef } from '@/composables/useLaggingRef';
import { unref } from 'vue';
import { markdownRenderFunction } from '@/main';

const editorRef = ref<ExposeParam>();
const contextMenu = useContextMenu();
const pastedImageBase46 = ref<string | undefined>("testing");
const networkStore = useNetworkStore();
const navigator = useNavigator();
const openedTabs = ref<OpenedTab[]>([]);
const notices = useNotices();
const userSelection = useUserSelection();
const mexp = new mathExp();
const mouseLocation = useMouse();
const lastMouseLocation = useLaggingRef<{x:number, y:number}>(ref(mouseLocation));
networkStore.connectSocket();
networkStore.onSocketEvent.subscribe(socketEventHandler);

const activeTab: ComputedRef<OpenedTab|undefined> = computed(() => { return openedTabs.value.find(x => x.isActive); });

const unsavedTabPaths = computed(() => 
{
    let result = openedTabs.value.filter(x => x.hasUnsavedChange).map(x => x.fullFilePath);
    console.log(result);
    return result;
}) as ComputedRef<String[]>;

const quickResult = computed(() => 
{   
    let hlText = userSelection.text.value;

    // ft to meters
    if (/^[0-9.]{1,}[ ]{0,1}(ft)|(feets)|(feet)/i.test(hlText))
    {
        let ft = parseFloat(hlText.split(' ')[0]);
        let r = new QuickResult('text');
        r.arg = `${ft} feet = ${(ft * 0.3048).toFixed(2)} meter(s)`;
        return r;
    }
    else if (/^#[0-9a-f]{6}$/i.test(hlText))
    {
        let hexToDec = (str:string) => { return parseInt(str, 16); }
        let hex = hlText.replace("#",''); // 123456
        let rgb = `${hexToDec(hex[0]+hex[1])}, ${hexToDec(hex[2]+hex[3])}, ${hexToDec(hex[4]+hex[5])}`;
        return new QuickResult('color', { hex: hex, rgb: rgb });
    }

    // Users may input maths equations to get quick result: 
    // The selection must contains a single "=" at the start for the function to be activated
    else if (/^={1}[0-9.\(\)\&a-z\+\-\*\/ \,\^]+$/.test(hlText))
    {
        let expression = hlText.split("=")[1];
        try
        {
            let result = mexp.eval(expression, [], {});
            return new QuickResult('text', `${expression} = ${result}`);
        }
        catch(ex) { return new QuickResult('text', `Invalid Expression: ${expression}`); }
    }
    else return new QuickResult('text', hlText);

}) as ComputedRef<QuickResult>;

// const selectedItemType = computed(() => 
// {
//     return selectedItem.value?.getType();
// }) as ComputedRef<string|undefined>;

async function uploadImage()
{
    if (!pastedImageBase46.value) return notices.push("No image to upload!", 1000);

    let randomName = makeid(5);
    let notice = notices.push(`Uploading image "${randomName}"...`);

    await networkStore.authPost(`/api/image`,
    {
        name: randomName,
        base64: pastedImageBase46.value
    })
    .then(data => 
    {
        let uploadedImageName = data.name;
        notice.content.value = `Uploaded image "${uploadedImageName}"!`;
        notice.fade(3000);

        // For some reasons, the editorRef here has a different structure than the Typescript Definitions.
        // @ts-ignore
        editorRef.value[0].insert(() => 
        {
            return { targetValue: `![New Image](api/image?name=${decodeURIComponent(uploadedImageName)})` } as any
        });
    })
    .catch(async (error: Response) => 
    {
        try 
        {
            let errorMessage = (await error.json()).message;
            notice.noticeType = "error";
            notice.content.value = `Error uploading image: ${errorMessage}`;
            notice.fade(10000);
        }
        catch(ex) 
        {
            let errorMessage = error;
            notice.noticeType = "error";
            notice.content.value = `Error uploading image: ${errorMessage}`;
            notice.fade(10000);
        }
    });
}

function makeid(length: number) 
{
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
}

/**
 * Rename an object (either a folder or a file).
 * This method will prompt user to enter a new name.
 * @param filePath 
 */
function renameObject(filePath:string)
{
    if (!filePath) return console.error(`renameObject: filePath cannot be undefined.`);
    if (networkStore.socket == undefined) return console.error(`renameObject: socket is not connected!`);

    let objType = filePath.endsWith("/") ? "folder" : "note";
    let newName = prompt("New name:");
    if (newName === null) return; // user cancelled the dialog

    if (newName?.trim() != "")
    {
        if (objType === 'note')
        {
            let notice = notices.push(`Renaming to "${newName}"...`);
            networkStore.authPost("/api/renameNote", 
            {
                socketIoId: networkStore.socket.id,
                oldFullPath: filePath,
                newName: newName
            })
            .then(() => 
            {
                notice.content.value = "Note successfully renamed."; 
                notice.fade(2000); 
            })
            .catch(async (error: Response) => 
            {
                let errorMessage = (await error.json()).message;
                notice.noticeType = "error";
                notice.content.value = `Error renaming note: ${errorMessage}`;
                notice.fade(5000);
            });
        }
        else if (objType === 'folder')
        {
            let notice = notices.push(`Renaming to "${newName}"...`);
            networkStore.authPost("/api/renameFolder", 
            {
                socketIoId: networkStore.socket.id,
                oldFullPath: filePath,
                newName: newName
            })
            .then(() => 
            {
                notice.content.value = "Folder successfully renamed."; 
                notice.fade(2000); 
            })
            .catch(async (error: Response) => 
            {
                let errorMessage = (await error.json()).message;
                notice.noticeType = "error";
                notice.content.value = `Error renaming folder: ${errorMessage}`;
                notice.fade(5000);
            });
        }
    }
    else alert(`Please enter a valid name.`);
}

async function socketEventHandler(handler: {eventName:string, arg: any})
{
    switch(handler.eventName)
    {
        case "directoryChanged":
            await navigator.updateDirectoryFiles(); 
            break;
        case "noteRenamed":
            // update the paths of all opened tabs (if needed)
            for (let tab of openedTabs.value)
                if (handler.arg.oldFullPath === tab.fullFilePath) 
                {
                    tab.fullFilePath = handler.arg.newFullPath;
                    tab.fileName = handler.arg.newNoteName;
                }
            await navigator.updateDirectoryFiles(); 
            break;
    }
}

function createNewNote(directoryFullPath:string)
{
    if (networkStore.socket?.id === undefined) return;

    let newNoteName = prompt("Note Name:");
    if (newNoteName === null || newNoteName === undefined) return;

    let notice = notices.push(`Creating note "${newNoteName}"...`);

    networkStore.authPost("/api/createNote", 
    {
        socketIoId: networkStore.socket.id,
        name: newNoteName,
        path: directoryFullPath
    })
    .then(() => { notice.fade(2000); })
    .catch(async (error: Response) => 
    {
        let errorMessage = (await error.json()).message;
        notice.noticeType = "error";
        notice.content.value = `Error creating note: ${errorMessage}`;
        notice.fade(5000);
    });
}

function createNewFolder(directoryFullPath:string)
{
    if (networkStore.socket?.id === undefined) return;

    let newFolderName = prompt("Folder Name:");
    let notice = notices.push(`Creating folder "${newFolderName}"...`);

    networkStore.authPost("/api/createFolder", 
    {
        socketIoId: networkStore.socket.id,
        name: newFolderName,
        path: directoryFullPath
    })
    .then(() => { notice.fade(2000); })
    .catch(async (error: Response) => 
    {
        let errorMessage = (await error.json()).message;
        notice.noticeType = "error";
        notice.content.value = `Error creating folder: ${errorMessage}`;
        notice.fade(5000);
    });
}

function onDirectoryClicked()
{
    lastMouseLocation.update();
    contextMenu.select(new FolderNavigatorItem(navigator.currentPath.value));
}

function onDirectoryFileClicked(pathItem: FileObjectType)
{
    lastMouseLocation.update();

    if (pathItem.type == 'Folder') 
        contextMenu.select(new FolderItem(navigator.currentPath.value + pathItem.objectName + '/'));
    else
        contextMenu.select(new FileItem(navigator.currentPath.value + pathItem.objectName)); // A file
}

function openNote(fullPath:string) 
{ 
    // see if the file is already opened
    if (isFileOpened(fullPath))
    { 
        notices.push("The file is already opened!", 5000);
        focusTab(fullPath); return; 
    }

    for (let openedTab of openedTabs.value) openedTab.isActive = false;
    let newTab = reactive(new OpenedTab(fullPath));
    // this.focusTab(newTab.fullFilePath);
    openedTabs.value.push( reactive(newTab) );
    newTab.isActive = true;
    newTab.load(tab => 
    { 
        newTab.hasUnsavedChange = false; 
        newTab.content = tab.content;
        setContent(newTab, tab.content);
        focusTab(newTab.fullFilePath); 
        newTab.hasUnsavedChange = false;
        document.title = newTab.fileName;
    });
}

function onFileClicked(file: FileObjectType)
{
    if (file.type == 'Folder') navigator.goToFolder(file.objectName);
    else openNote(navigator.currentPath.value + file.objectName);
}

function focusTab(fullPath:string)
{
    let oldTab = activeTab.value;
    let oldTabUnsaved = oldTab?.hasUnsavedChange ?? true;

    let tab = openedTabs.value.find(x => x.fullFilePath == fullPath);
    if (tab == undefined) return;
    for (let openedTab of openedTabs.value) openedTab.isActive = false;
    tab.isActive = true;

    if (tab == undefined || oldTab == undefined) return;
    oldTab.hasUnsavedChange = oldTabUnsaved;
}

function saveCurrentTab()
{
    if (activeTab.value == undefined) return;
    if (activeTab.value.fileName == undefined) return;

    let fileNameOld = activeTab.value.fileName;

    let notice = notices.push(`Saving ${fileNameOld}...`);

    activeTab.value.saveContent().then((data) => 
    {
        console.log(data);
        notice.content.value = `Saved ${fileNameOld}!`;
        notice.fade(5000);
        setTimeout(() => { notices.cleanup() }, 10000); // Cleanup
    })
    .catch(async (response: Response) => 
    {
        let body = await response.json();
        notice.noticeType = 'error';
        if (body) notice.content.value = `Error saving ${fileNameOld}: ${body.name}`;
        else notice.content.value = `Error saving ${fileNameOld}: ${response.status}(${response.statusText})`;
        notice.fade(15000);
        setTimeout(() => { notices.cleanup() }, 10000); // Cleanup
    });
}

function sanitizeOutputHTML(inputHtml:string)
{   
    // return inputHtml;

    let allowedTags = 
    sanitizeHtml.defaults.allowedTags // all the default allowed tags (see https://www.npmjs.com/package/sanitize-html)
    .concat([ 'svg', 'img', 'path' ]) // equations uses SVG, and we would like to allow images as well
    .concat([ 'br', 'hr' ]) // we also want some styling tags
    .concat([ 'math', 'semantics', 'mrow', 'mi', 'mo', 'msqrt', 'msup', 'mn' ]); // used by katex

    let allowedAttr = 
    {
        '*': ['style', 'aria-hidden', 'language'], // we want to allow style on all tags
        'svg': ['xmlns', 'width', 'height', 'viewbox', 'preserveaspectratio'], // we need these to display equations and svg,
        'path': ['d'],
        'img': ["src", 'alt']
    };

    // let sanitizedHTML = sanitizeHtml(inputHtml, 
    // {
    //     parseStyleAttributes: true,
    //     allowedClasses: { '*': ['*'] },
    //     allowedAttributes: allowedAttr,
    //     allowedTags: allowedTags
    // });

    // Inject safe events (these events are not subject to XSS attacks, since we already sanitized the input being injecting events)
    // and the events are not based on user inputs.
    let dom = new DOMParser().parseFromString(inputHtml, "text/html");
    dom.body.querySelectorAll(`.container_spoiler`).forEach(container => 
    {
        container.setAttribute("onclick", "this.classList.toggle(\"revealed\")");
    });

    // Add default stylesheet
    dom.body.innerHTML += 
    `
        <style>details { background: #222222; padding:5px; padding-left:15px; margin-top:5px; }</style>
    `;

    // We need to render all md tags before processing mdt tags
    if (markdownRenderFunction)
    {
        dom.body.querySelectorAll("md").forEach(mdTag => 
        {
            let modifedHTML = mdTag.innerHTML;
            mdTag.innerHTML = markdownRenderFunction(modifedHTML);
        });
    }

    // Retreive all <mdt> tag
    let mdTemplates: {[key: string]: string} = {};
    dom.body.querySelectorAll("mdt").forEach(mdTag => 
    {
        let templateID = mdTag.getAttribute("templateid");
        if (!templateID) return;
        mdTemplates[templateID] = mdTag.innerHTML;
        mdTag.outerHTML = ""; // remove all the mdt tags, since they are not rendered
    });

    // Render all <md> and <mdr> tag 
    if (markdownRenderFunction)
    {
        let definedTemplateIDs = Object.keys(mdTemplates);

        dom.body.querySelectorAll("mdr").forEach(mdTag => 
        {
            if (mdTag.getAttributeNames().length == 0) 
            {
                mdTag.innerHTML = `<p style="color:red">Please provide a templateID.</p>`;
                return;
            }

            let templateID = mdTag.getAttributeNames()[0];

            if (mdTemplates[templateID] == undefined)
            {
                mdTag.innerHTML = `<p style="color:red">Template with templateID \"${templateID}\" is not found!</p>`;
                return;
            }

            mdTag.innerHTML = markdownRenderFunction(mdTemplates[templateID]);
        });
    }

    return dom.body.innerHTML;
}

function setContent(tab:OpenedTab, content:string)
{
    if (tab == undefined) return;
    tab.content = content;
    tab.hasUnsavedChange = true;
}

function isFileOpened(fullPath:string)
{
    return openedTabs.value.find(tab => tab.fullFilePath == fullPath) != undefined;
}

function closeTab(fullPath:string)
{
    let tab = openedTabs.value.find(tab => tab.fullFilePath == fullPath);
    if (tab == undefined) return console.warn(`The tab \"${fullPath}\" is not found!"`);
    if (tab.hasUnsavedChange) 
    { 
        let promptMessage = `The file ${tab.fullFilePath} has unsaved changes, do you still want to close the file?`;
        if (!confirm(promptMessage)) return; 
    }
    openedTabs.value = openedTabs.value.filter(tab => tab.fullFilePath != fullPath);
}

async function onEditorPaste(event: ClipboardEvent)
{
    if (!event?.clipboardData) return;

    let items = (event.clipboardData).items;
    for (let item of items) 
    {
        if (item.kind === 'file') 
        {
            let blob = item.getAsFile();
            if (!blob) return;
            let reader = new FileReader();
            reader.onload = function(event2)
            {
                if (!event2?.target) return;
                if (!event2?.target?.result) return;
                pastedImageBase46.value = event2.target.result.toString();
            }; // data url!
            reader.readAsDataURL(blob);
        }
    }
}

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
        this.networkStore.authGet(`/api/openNote?path=${encodeURIComponent(this.fullFilePath)}`)
        .then(data => 
        {
            this.content = data.content;
            this.isLoading = false;
            nextTick(() => { if (onloadCallback) onloadCallback(this); });
        });
    }

    public async saveContent()
    {
        await this.networkStore.authPost(`/api/updateNote?path=${encodeURIComponent(this.fullFilePath)}`, { content: this.content });
        this.hasUnsavedChange = false;
    }   
}
</script>

<template>

    <!-- <div class="fullSize fixed center" style="background:#00000099; z-index:9999;" v-if="pastedImageBase46">
        <div >
            <p>Upload Image:</p>
        </div>
    </div> -->
    <model @click="pastedImageBase46 = undefined" :visible="pastedImageBase46" :title="'Upload Images'">
        <div class="fullSize" style="display:grid; grid-template-columns: 1fr; grid-template-rows: auto auto; gap:15px;">
            <div class="fullSize xCenter">
                <img style="background-size: contain; width:300px;" :src="pastedImageBase46"/>
            </div>
            <div class="xRight">
                <div>
                    <button @click="pastedImageBase46 = undefined" class="modelButton">Cancel</button>
                    <button @click="uploadImage" class="modelButton">Upload</button>
                </div>
            </div>
        </div>
    </model>

    <div class="contextMenuContainer" v-if="contextMenu.hasSelected.value">
        <div v-fixed-pos="unref(lastMouseLocation.lastValue)" class="contextMenu">
            <div v-if="contextMenu.activeType.value === 'Folder'">
                <TempVar :define="{ 'fullPath': (contextMenu.activeItem.value as FolderItem).fullPath }" #defined="{fullPath}">
                    <div @click="navigator.goToPath(fullPath); contextMenu.reset();">Open</div>
                    <div @click="contextMenu.reset(); renameObject(fullPath);">Rename</div>
                </TempVar>
            </div>
            <div v-else-if="contextMenu.activeType.value === 'File'">
                <TempVar :define="{ 'fullPath': (contextMenu.activeItem.value as FileItem).fullPath }" #defined="{fullPath}">
                    <div @click="openNote(fullPath); contextMenu.reset();">Open</div>
                    <div @click="contextMenu.reset(); renameObject(fullPath);">Rename</div>
                </TempVar>
            </div>
            <div v-else-if="contextMenu.activeType.value === 'FolderNavigator'">
                <TempVar :define="{ 'fullPath': (contextMenu.activeItem.value as FileItem).fullPath }" #defined="{fullPath}">
                    <div @click="createNewNote(navigator.currentPath.value); contextMenu.reset();">New Note</div>
                    <div @click="createNewFolder(navigator.currentPath.value); contextMenu.reset();">New Folder</div>
                </TempVar>
            </div>
        </div>
        <div class="contextBackdrop" @click="contextMenu.reset"></div>
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
                <div id="directoryloadingCircle" v-if="navigator.isLoading.value">
                    <img class="loadingSpinner" src="@/assets/loadingIcon.png">
                </div>
                <div :class="{'disabled': navigator.isLoading.value, 'opened': isFileOpened(navigator.currentPath.value + file.objectName)}" 
                v-for="file in navigator.pathFiles.value" @click="onFileClicked(file)" @contextmenu.prevent="onDirectoryFileClicked(file)">
                    <div class="fileName">{{ file.objectName }}</div>
                    <div class="fileIcon">
                        <span class="material-symbols-outlined icon" v-if="file.type == 'Folder'">chevron_right</span>
                    </div>
                </div>
                <div @contextmenu.prevent="onDirectoryClicked()" class="directoryEmptyPart"></div>
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
            <div id="contentArea" @paste="onEditorPaste" class="rel">
                <div id="welcomeScreen" v-if="openedTabs.length == 0">
                    <div>
                        <div class="fullWidth center">
                            <p id="welcomeTitle" class="tight">NOTETAKER</p>
                        </div>
                        <div class="fullWidth center">
                            <img id="welcomeAppIcon" src="/appIcon.png">
                        </div>
                        <div class="fullWidth center">
                            <p id="welcomeDescription">A web-based extended markdown editor, on steriod!</p>
                        </div>
                        <!-- <span class="material-symbols-outlined icon">note_add</span> -->
                    </div>
                    <div class="fullSize center">
                        <div class="fullWidth">
                            <div id="welcomeCtaButtonsContainer">
                                <div class="fullWidth center">
                                    <button class="welcomeCtaButton">
                                        <div>
                                            <span class="material-symbols-outlined icon">new_window</span>
                                            <div class="fullSize xLeft yCenter tight"><p>Create a new note at root</p></div>
                                        </div>
                                    </button>
                                </div>
                                <div class="fullWidth center">
                                    <button class="welcomeCtaButton">
                                        <div>
                                            <span class="material-symbols-outlined icon">help</span>
                                            <div class="fullSize xLeft yCenter tight"><p>Access tutorials</p></div>
                                        </div>
                                    </button>
                                </div>
                                <div class="fullWidth center">
                                    <button class="welcomeCtaButton">
                                        <div>
                                            <span class="material-symbols-outlined icon">tune</span>
                                            <div class="fullSize xLeft yCenter tight"><p>Customize editor</p></div>
                                        </div>
                                    </button>
                                </div>
                                <div class="fullWidth center">
                                    <button class="welcomeCtaButton">
                                        <div>
                                            <span class="material-symbols-outlined icon">keyboard_command_key</span>
                                            <div class="fullSize xLeft yCenter tight"><p>Modify keybinds</p></div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                            <div id="welcomeTips" class="fullWidth center">
                                <div>
                                    <div id="tipsHeader">
                                        <span class="material-symbols-outlined icon">lightbulb</span>
                                        <div class="fullSize xLeft yCenter tight"><p>TIPS</p></div>
                                    </div>
                                    <div id="tipsContent">
                                        <p>You may include iframes inside note if permission is granted!</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div v-for="tab in openedTabs.filter(tab => tab.isActive)" :key="tab.fullFilePath" :class="{'fullSize': tab.isLoading}">
                    <div v-if="tab.isLoading" class="fullSize center">
                        <img class="loadingSpinner" src="@/assets/loadingIcon.png">
                    </div>
                    <MdEditor v-selection-changed ref="editorRef" v-if="tab.isActive && !tab.isLoading" theme="dark" :autoDetectCode="true"
                        class="fullHeight fullSizeAbs noBorder" language="en-US" :modelValue="tab.content"
                        @onSave="saveCurrentTab()" :sanitize="sanitizeOutputHTML" :onChange="x => setContent(tab, x)"></MdEditor>
                </div>
                <div id="noticesOverlay">
                    <div class="notice" :class="notice.noticeType" v-for="notice in notices.notices.value" :key="notice.content">
                        <div :style="{'opacity': notice.noticeOpacity}">{{ notice.content }}</div>
                    </div>
                </div>
            </div>
            <div id="footerArea">
                <TempVar :define="{ 'arg': quickResult.arg, 'type': quickResult.type }" #defined="{arg, type}">
                    <div v-if="type == 'text'" class="text">{{ arg }}</div>
                    <div v-if="type == 'color'" class="color">
                        <div class="description">#{{ arg.hex }}, rgb({{ arg.rgb }}):</div>
                        <div class="colorPreviewContainer">
                            <div :style="{'background': `#${arg.hex}`}"></div>
                        </div>
                    </div>
                </TempVar>
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
        min-height:10px; background:@backgroundDark;
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

.modelButton 
{
    .tight;
    padding:5px;
    color: @foreground;
    margin-left:5px;
    cursor: pointer;
    background:@backgroundDark;
    border: 1px solid @border;
    &:hover { background: @surface; }
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

    #welcomeScreen
    {
        .fullSize; .center;
        p { .text; }
        display:grid;
        grid-template-columns: 1fr 1fr;
        grid-template-rows: 1fr;

        #welcomeAppIcon 
        { 
            margin:25px; 
            animation-duration: 15s;
            animation-name: appIconHueAnimation;
            animation-iteration-count: infinite;
        }
        #welcomeTitle { font-size:42px; font-weight: bold; }
        #welcomeDescription { font-weight: bold; }

        @keyframes appIconHueAnimation 
        {
            0% { filter:hue-rotate(0deg); }    
            50% { filter:hue-rotate(360deg); }    
            100% { filter:hue-rotate(0deg); }
        }

        #welcomeCtaButtonsContainer
        {
            .welcomeCtaButton 
            {
                width:40%;
                margin:15px;
                div { display:grid; grid-template-columns: auto 1fr; grid-template-rows: 1fr; }
                span { margin-right:15px; }
                p { .tight; display:inline; font-size: 16px; transform: translateY(1px); margin-right:5px; }
                background: @backgroundDark;
                color: @foreground;
                padding:15px;
                border:1px solid @border;
                &:hover { cursor:pointer; background: @background;}
            }
        }

        #welcomeTips
        {
            margin-top:25px;

            #tipsHeader
            {
                .fullWidth; padding:15px; gap:15px;
                display:grid; grid-template-columns: auto 1fr; grid-template-rows: 1fr;
                p { .tight; transform: translateY(1px); font-weight: 900; }
                span { color: @foreground; }
            }

            #tipsContent
            {
                padding:25px; padding-top:5px;
                p { .tight; transform: translateY(1px); }
            }

            & > div 
            { 
                width:70%;
                background: @backgroundDark !important; 
                display:grid;
                grid-template-columns: 1fr;
                grid-template-rows: auto auto;
            }
        }
    }
}

</style>