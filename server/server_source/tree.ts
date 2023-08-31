import { log } from "console";
import { logGreen, logRed, logYellow } from "./extendedLog";
import { FolderClass, FolderModel } from "./folder";
import { NoteClass, NoteModel } from "./note";
import { ObjectType, ensurePath, getPathType, walkPath } from "./path"

/**
 * This method should only be used in this file. Because all folders end with "/".
 * This method is only intended for use by getPathDecentants.
 * @param path 
 * @returns 
 */
async function getPathChildren(path:string)
{
    ensurePath(path);
    let pathType = getPathType(path);

    if (pathType == ObjectType.File) return [];
    else 
    {
        let foldersChildren = (await FolderModel.find(
        {
            parentFolder: path  
        })).map(f => f.folderName + "/");

        let notesChildren = (await NoteModel.find(   
        {
           directory: path 
        })).map(n => n.name);

        return [...foldersChildren, ...notesChildren];
    }
}

type fileObject = 
{
    name: string,
    type: ObjectType,
    directory: string,
    children: fileObject[]
};

async function getPathDecentants(path: string): Promise<fileObject[]>
{
    ensurePath(path);
    let pathType = getPathType(path);

    if (pathType == ObjectType.File) return [];

    let result = [] as fileObject[];
    let children = getPathChildren(path);
    for (let child of await children)
    {
        let childFullPath = path + child;
        let chlidType = getPathType(childFullPath);

        result.push(
        {
            name: child,
            directory: path,
            type: chlidType,
            children: await getPathDecentants(childFullPath)
        });
    }
    return result;
}

export function printFileObject(level: number, obj: fileObject)
{
    const block     = "|  ";
    const blockLink = "+--";
    const indend = new Array(level).join(block) + blockLink;
    const type = obj.type;
    // log(`${new Array(level + 1).join(block)}`);
    if (type == ObjectType.File) log(`${indend}${obj.name} (File)`);
    else if (type == ObjectType.Folder) logYellow(`${indend}${obj.name} (Folder)`);
    for (let child of obj.children) printFileObject(level+1, child);
}

export async function printTree()
{
    logYellow("root");
    for (let child of await getPathDecentants("/root/")) printFileObject(1, child);
}

/**
 * Check if all of the parts in a path exist. 
 * Will return error if the path is not valid. Will return false if it failed validation.
 * Will print errors to console if there is any error unless verbose is set to false.
 */
export async function validatePath(path:string, verbose=true)
{
    // "/root/folder1/folder2/folder3/" => ["/root/folder1/", "/root/folder1/folder2", "/root/folder1/folder2/folder3/"]
    // "/root/folder1/folder2/note"     => ["/root/folder1/", "/root/folder1/folder2", "/root/folder1/folder2/note"]
    let pathsToBeChecked = walkPath(path);  

    for (let path of pathsToBeChecked)
    {
        let type = getPathType(path); 

        if (type == ObjectType.File && (await NoteClass.isNoteExist(path) == false)) 
        {
            if (verbose) logRed(`The file path \"${path}\" does not exist!`);
            return false;
        }
        if (type == ObjectType.Folder && await FolderClass.isFolderExists(path) == false) 
        {
            if (verbose) logRed(`The folder path \"${path}\" does not exist!`);
            return false;
        }
    }

    return true;
}

/**
 * Check if the current folder/note tree is clear and correct.
 * Will print errors to console if there is any error.
 */
export async function validateTree()
{
    try
    {
        let dbFolderCount = (await FolderModel.find()).length;
        let dbNotesCount = (await NoteModel.find()).length;

        let computedCount = await FolderModel.getFolderDescendants("/root/");

        let notesDiff = Math.abs(computedCount.notes.length - dbNotesCount);
        let foldersDiff = Math.abs(computedCount.folders.length - dbFolderCount);

        for (let path of [...computedCount.folders, ...computedCount.notes]) 
        {
            if (await validatePath(path) == false) 
            {
                logRed(`Path \"${path}\" failed validation!! The tree system is possibly corrupted!!`);
                return false;
            }
        }

        if (notesDiff != 0 || foldersDiff != 0) return false;

        return true;
    }
    catch(ex) { return false; }
}