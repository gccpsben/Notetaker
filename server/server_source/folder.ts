import { getModelForClass, modelOptions,prop } from "@typegoose/typegoose";
import { ObjectType, ensureFolderName, ensurePath, getFolderName, getFolderParent, getNoteName, getNoteParent, getPathType, isPathInFolder } from "./path";
import { dbMongoose } from "./databaseOperations";
import { NoteClass, NoteModel } from "./note";


export class FolderExistsError extends Error 
{
    constructor(directory, folderName) 
    {
        var m = `Folder '${folderName}' already exist in ${directory}`;
        super();
        this.name = "FolderExistsError";
        this.message = m;
    }
}
export class FolderNotFoundError extends Error 
{
    constructor(directory:string, folderName:string);
    constructor(fullPath:string);

    constructor(firstArg:string, secondArg?:string)
    {
        super();
        this.name = "FolderNotFoundError";
        if (secondArg == undefined) // in fullPathMode
        {
            this.message = `The folder ${firstArg} is not found.`;
            return;
        }
        this.message = `The folder ${secondArg} does not exist in ${firstArg}`;
    }
}
export class PathNotFoundError extends Error 
{
    constructor(directory) 
    {
        var m = `One of the nodes in ${directory} is not found.`;
        super();
        this.name = "PathNotFoundError";
        this.message = m;
    }
}


@modelOptions ( { schemaOptions: { autoCreate: false , collection: "folders" }, existingConnection:dbMongoose } )
export class FolderClass
{
    @prop({required:true})
    public folderName!: string; // example "Folder1"

    @prop({required:true})
    public parentFolder!: string; // example "/root/parentFolder/"

    public constructor(folderName:string, parentFolder:string) 
    {
        ensurePath(parentFolder, ObjectType.Folder);
        ensureFolderName(folderName);
        this.folderName = folderName;
        this.parentFolder = parentFolder;
    }

    public getFullFolderPath():string { return this.parentFolder + this.folderName + "/"; }

    public static async isFolderExists(folderPath:string)
    {
        if (folderPath == "/root/") return true;
        ensurePath(folderPath, ObjectType.Folder);
        let parentFolder = getFolderParent(folderPath);
        let folderName = getFolderName(folderPath);

        return (await FolderModel.find(
        {
            folderName: folderName,
            parentFolder: parentFolder
        })).length > 0;
    }

    public static async ensureFolderExists(folderPath:string)
    {
        ensurePath(folderPath, ObjectType.Folder);
        if (await this.isFolderExists(folderPath) == false) throw new FolderNotFoundError(folderPath);
    }

    /**
     * Delete a folder forever (including the folder itself and content).
     */
    public static async deleteFolder(folderPath: string)
    {
        if (folderPath == "/root/") throw new Error(`Cannot delete root folder. Use emptyFolder instead.`);
        await this.emptyFolder(folderPath); // delete all the content of the folder
        await FolderModel.findOne({
            parentFolder: getFolderParent(folderPath),
            folderName: getFolderName(folderPath)
        }).deleteOne(); // delete the remaining folder
    }

    public static async emptyFolder(folderPath:string)
    {
        ensurePath(folderPath, ObjectType.Folder);
        if (await this.isFolderExists(folderPath) == false) throw new FolderNotFoundError(folderPath);

        let allDescendants = await this.getFolderDescendants(folderPath);

        for (let note of allDescendants.notes)
        {
            let noteDoc = await NoteModel.findOne({
                directory: getNoteParent(note),
                name: getNoteName(note)
            });
            await noteDoc.deleteOne();
        }
        for (let folder of allDescendants.folders)
        {
            let folderDoc = await FolderModel.findOne({
                parentFolder: getFolderParent(folder),
                folderName: getFolderName(folder)
            });
            await folderDoc.deleteOne();
        }
    }

    public static async createFolder(parentFolderPath: string, folderName:string)
    {
        let newFolder = new FolderClass(folderName, parentFolderPath);
        
        let parentFolderExists = await FolderClass.isFolderExists(parentFolderPath);
        if (!parentFolderExists) throw new PathNotFoundError(parentFolderPath);

        let newFolderExists = await FolderClass.isFolderExists(parentFolderPath + folderName + "/");
        if (newFolderExists) throw new FolderExistsError(parentFolderPath, folderName);

        await FolderModel.create(
        {
            folderName: newFolder.folderName,
            parentFolder: newFolder.parentFolder 
        });
    }

    /**
     * Return all the descendants (objects inside a folder) of a folder. This includes nested folders and files as well.
     */
    public static async getFolderDescendants(folderPath: string)
    {
        ensurePath(folderPath, ObjectType.Folder);
        if (!this.isFolderExists(folderPath)) throw new FolderNotFoundError(folderPath);

        let allFolders = (await FolderModel.find());
        let allNotes = (await NoteModel.find());

        // List of all folders that are inside the original folder
        let childrenFolders = allFolders.filter(folder => isPathInFolder(folderPath, folder.getFullFolderPath()));
        // List of all notes that are inside the original folder
        let childrenNotes = allNotes.filter(note => isPathInFolder(folderPath, note.getNoteFullPath()));

        // Exclude the folder original folder itself
        childrenFolders = childrenFolders.filter(folder => folder.getFullFolderPath() != folderPath);

        return {
            folders: childrenFolders.map(f => f.getFullFolderPath()),
            notes: childrenNotes.map(n => n.getNoteFullPath())
        };
    }

    /**
     * Move a folder (and all content) into another folder.
     * @param originalFolderFullPath 
     * @param destinationParentFullPath 
     */
    public static async moveFolder(originalFolderFullPath:string, destinationParentFullPath: string)
    {
        ensurePath(originalFolderFullPath, ObjectType.Folder);
        ensurePath(destinationParentFullPath, ObjectType.Folder);
        let oldFolderName = getFolderName(originalFolderFullPath);

        if (await FolderClass.isFolderExists(originalFolderFullPath) == false)
        throw new FolderNotFoundError(originalFolderFullPath);

        if (await FolderClass.isFolderExists(destinationParentFullPath + oldFolderName + "/"))
        throw new FolderExistsError(destinationParentFullPath, oldFolderName);
        
        if (isPathInFolder(originalFolderFullPath, destinationParentFullPath) || originalFolderFullPath == destinationParentFullPath)
        throw new Error(`Cannot move folder ${originalFolderFullPath} to ${destinationParentFullPath}`);

        // Create a folder in the target
        await FolderClass.createFolder(destinationParentFullPath, oldFolderName);

        // Move all of the content to the new folder
        await this.moveFolderContent(originalFolderFullPath, destinationParentFullPath + oldFolderName + "/");

        // Delete the old folder
        await FolderClass.deleteFolder(originalFolderFullPath);
    }

    /**
     * Move all the content of a folder into another folder. The original folder will not be deleted.
     * @param originalFolderFullPath 
     * @param destinationParentFullPath 
     */
    public static async moveFolderContent(originalFolderFullPath:string, destinationParentFullPath: string)
    {
        ensurePath(originalFolderFullPath, ObjectType.Folder);
        ensurePath(destinationParentFullPath, ObjectType.Folder);

        let folderName = getFolderName(originalFolderFullPath);
        let newParentFolder = destinationParentFullPath;
        let allDescendants = await this.getFolderDescendants(originalFolderFullPath);
        let newParentFolderName = getFolderName(destinationParentFullPath);

        // Check if original folder exists
        let originalFolderExists = await FolderClass.isFolderExists(originalFolderFullPath);
        if (!originalFolderExists) throw new PathNotFoundError(originalFolderFullPath);
        
        // // Check if the target location exists
        // let newLocationExists = await FolderClass.isFolderExists(newParentFolder + folderName + "/");
        // if (newLocationExists) throw new FolderExistsError(newParentFolder, folderName);

        // Check for invalid args.
        if (originalFolderFullPath == destinationParentFullPath)
        throw new Error(`Cannot move folder ${originalFolderFullPath} to ${destinationParentFullPath}`);        

        let transformPath = (oldPath) => 
        {
            let newPath = oldPath.replace(originalFolderFullPath, destinationParentFullPath);
            return newPath;
        };

        let transactions = [] as Array<
        {
            oldPath: string,
            newPath: string,
            type: ObjectType
        }>;
        
        [...allDescendants.folders, ...allDescendants.notes].forEach(x => 
        {
            let type = getPathType(x);
            let newPath = transformPath(x);
            transactions.push({ oldPath: x, newPath: newPath, type: type });
        });

        // Check if the content in the old folder, colide with the content in the target folder.
        for (let txn of transactions)
        {
            if (txn.type == ObjectType.File)
            {
                if (await NoteClass.isNoteExist(txn.newPath) == true) 
                throw new Error(`The file \"${txn.newPath}\" already exist. Make sure the content in the old folder does not colide with the content in the target folder.`);
            }
            else if (txn.type == ObjectType.Folder)
            {
                if (await FolderClass.isFolderExists(txn.newPath) == true) 
                throw new Error(`The folder \"${txn.newPath}\" already exist. Make sure the content in the old folder does not colide with the content in the target folder.`);
            }
        }

        // This loop should not be combined with the above loop, we need to make sure no files colide before executing any transaction.
        for (let txn of transactions)
        {
            if (txn.type == ObjectType.File)
            {
                let noteDoc = await NoteModel.findOne(
                {
                    directory: getNoteParent(txn.oldPath),
                    name: getNoteName(txn.oldPath)
                });

                noteDoc.directory = getNoteParent(txn.newPath);
                await noteDoc.save();
            }
            else
            {
                let folderDoc = await FolderModel.findOne(
                {
                    parentFolder: getFolderParent(txn.oldPath),
                    folderName: getFolderName(txn.oldPath)
                });

                folderDoc.parentFolder = getFolderParent(txn.newPath);
                await folderDoc.save();
            }
        }
    }

    public static async rename(originalFolderFullPath:string, newName:string)
    {
        ensureFolderName(newName);
        await this.ensureFolderExists(originalFolderFullPath);

        if (originalFolderFullPath == "/root/") throw new Error(`The root folder may not be renamed.`);

        let newFolderFullPath = getFolderParent(originalFolderFullPath) + newName + "/";
        let allDescendants = await this.getFolderDescendants(originalFolderFullPath);

        // Instead of getting folder one by one, we batch them together in a single request using $or
        let folderDocs = allDescendants.folders.length == 0 ? [] : await FolderModel.find(
        {
            $or: allDescendants.folders.map(f =>
            {
                return { folderName: getFolderName(f), parentFolder: getFolderParent(f) }
            })
        });
        let noteDocs = allDescendants.notes.length == 0 ? [] : await NoteModel.find(
        {
            $or: allDescendants.notes.map(n =>
            {
                return { name: getNoteName(n), directory: getNoteParent(n) }
            })
        });

        // Rename the directory of all the descendants
        for (let folderDoc of folderDocs)
        {
            let newParentFolder = folderDoc.parentFolder.replace(originalFolderFullPath, newFolderFullPath) ;
            await folderDoc.updateOne({ $set: { parentFolder: newParentFolder } });
        }
        for (let noteDoc of noteDocs)
        {
            let newParentFolder = noteDoc.directory.replace(originalFolderFullPath, newFolderFullPath);
            await noteDoc.updateOne({ $set: { directory: newParentFolder } });
        }

        // Rename the name of the folder
        await FolderModel.updateOne(
        {
            parentFolder: getFolderParent(originalFolderFullPath),
            folderName: getFolderName(originalFolderFullPath)
        }, { $set:{ folderName: newName } });
    }

    public static async getFolderChildren(folderFullPath:string): Promise<Array<{objectName: string, type: ObjectType}>>
    {
        ensurePath(folderFullPath, ObjectType.Folder);
        await this.ensureFolderExists(folderFullPath);
        let allFolders = (await FolderModel.find({ parentFolder: folderFullPath })).map(f => 
        {
            return { objectName: f.folderName, type: ObjectType.Folder }
        });
        let allNotes = (await NoteModel.find({ directory: folderFullPath })).map(f => 
        {
            return { objectName: f.name, type: ObjectType.File }
        });
        return [...allFolders, ...allNotes];
    }
}

export const FolderModel = getModelForClass(FolderClass);