import { useNetworkStore } from '@/stores/networkStore';
import type { APIListDirResponseType } from '@/types';
import { ref, onMounted, onUnmounted, computed } from 'vue';

export function useNavigator(startingPath:string = '/root/')
{
    let networkStore = useNetworkStore();

    const currentPath = ref(startingPath);
    const pathFiles = ref([] as APIListDirResponseType);
    const isLoading = ref(false);
    const currentFolderName = computed(() => { return `/${currentPath.value.split("/").slice(-2)[0]}/` });

    async function updateDirectoryFiles()
    {
        let queryURL = `/api/listDir?path=${currentPath.value}`;
        isLoading.value = true;
        let data = await networkStore.authGet(queryURL);
        pathFiles.value = data;
        isLoading.value = false;
    }

    async function goToParent()
    {
        if (currentPath.value === "/root/") return; 
        currentPath.value = [...currentPath.value.split("/").slice(0, -2), ''].join("/");
        await updateDirectoryFiles();
    }

    async function goToFolder(folderName:string)
    {
        if (pathFiles.value.find(x => x.objectName == folderName && x.type == 'Folder') == undefined) 
        throw new Error(`There's no folder named '${folderName}' in path '${currentPath.value}'`);

        currentPath.value = startingPath + folderName + '/';
        await updateDirectoryFiles();
    }

    async function goToPath(folderFullPath: string)
    {
        currentPath.value = folderFullPath;
        await updateDirectoryFiles();
    }

    function isRoot() { return currentPath.value === '/root/'; };

    updateDirectoryFiles();

    let returns = 
    { 
        currentPath, 
        pathFiles, 
        isLoading, 
        updateDirectoryFiles,
        goToFolder, 
        goToPath,
        goToParent,
        isRoot,
        currentFolderName
    };

    return returns;
};