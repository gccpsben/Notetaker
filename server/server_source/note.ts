import { getModelForClass, modelOptions, prop } from "@typegoose/typegoose";
import { ObjectType, ensureFileName, ensureFolderName, ensurePath, getFolderParent, getNoteName, getNoteParent } from "./path";
import sanitize = require("mongo-sanitize");
import { dbMongoose } from "./databaseOperations";
import { FolderClass, FolderNotFoundError } from "./folder";

export type File =
{
    name: string,
    directory: string,
    type: 'folder'|'note'
}

export class FileExistsError extends Error 
{
    constructor(directory, fileName) 
    {
        var m = `'${fileName}' already exist in ${directory}`;
        super();
        this.name = "FileExistsError";
        this.message = m;
    }
}
export class FileNotExistsError extends Error 
{
    constructor(directory:string, fileName:string);
    constructor(fileFullPath:string);

    constructor(directoryOrFullpath :string, fileName?:string) 
    {
        super();
        this.name = "FileNotExistsError";
        
        if (fileName == undefined) this.message = `The file \"${directoryOrFullpath}\" is not found.`;
        else this.message = `The file \"${directoryOrFullpath}${fileName}\" is not found.`;
    }
}

@modelOptions ( { schemaOptions: { autoCreate: false , collection: "notes" }, existingConnection:dbMongoose } )
export class NoteClass
{
    // @prop({required:true})
    // public type!: string;

    @prop({required:true})
    public name!: string;

    @prop({required:true})
    public directory!: string;

    @prop({required:true})
    public content!: string;

    public constructor() { }

    public static async createNewNote (content:string, folderPath:string, name:string)
    {
        ensurePath(folderPath, ObjectType.Folder);
        ensureFileName(name);
        
        let duplicateFound = await NoteClass.isNoteExist(folderPath, name);
        if (duplicateFound) throw new FileExistsError(folderPath, name);

        let folderExists = await FolderClass.isFolderExists(folderPath);
        if (!folderExists) throw new FileNotExistsError(folderPath, name);

        let newNoteDocument = new NoteModel();
        newNoteDocument.name = name;
        newNoteDocument.directory = sanitize(folderPath);
        newNoteDocument.content = content;
        await newNoteDocument.save();

        return newNoteDocument;
    }

    public getNoteFullPath():string { return this.directory + this.name; }

    // /**
    //  * 
    //  * @param {string} pathDirectory
    //  * @param {string} name 
    //  * @returns 
    //  */
    // public static async isFolderDuplicate (pathDirectory:string, name:string)
    // {
    //     // find folders with the same name, in the same path
    //     let duplicateObjects = await NoteModel.find(
    //     {
    //         type: "folder",
    //         directory: sanitize(pathDirectory),
    //         name: sanitize(name)    
    //     });
    //     let duplicateFound = duplicateObjects.length != 0;
    //     return duplicateFound;
    // }

    //  /**
    //  * Rename a folder in a given path.
    //  * @param {*} pathDirectory 
    //  * @param {*} oldName
    //  * @param {*} newName
    //  * @throws Will throw error if the path directory already contains a folder with the same name, or the given name is not found.
    //  */
    // public static async renameFolder (pathDirectory:string, oldName:string, newName:string)
    // {   
    //     let directoryToBeSaved = urlJoin(pathDirectory, "/")
    //     let isNameUsed = await NoteClass.isFolderDuplicate(directoryToBeSaved, newName);

    //     if (isNameUsed) throw new FileExistsError(pathDirectory, newName);
    //     else if (await NoteClass.isFolderExist(directoryToBeSaved, oldName) == false) throw new FileNotExistsError(pathDirectory, oldName);

    //     let oldDocument = await NoteModel.findOne(
    //     {
    //         name: sanitize(oldName),
    //         type: sanitize("folder"),
    //         directory: sanitize(directoryToBeSaved)
    //     });

    //     //#region Update folder name of the folder object
    //     oldDocument.name = sanitize(newName);
    //     //#endregion

    //     //#region Update the path of all files in the folder
    //     let inner = urlJoin(pathDirectory,oldName);
    //     let filterRegex =  new RegExp(`^\\${inner}`);
    //     const subseqFilter = { directory: filterRegex };

    //     (await NoteModel.find(subseqFilter)).forEach(async (note) => 
    //     {
    //         note.directory = note.directory.replace(filterRegex, urlJoin(pathDirectory, newName));

    //         // notesCollection.updateOne({_id: document._id}, 
    //         // {
    //         //     $set: 
    //         //     {
    //         //         "directory": document.directory.replace(filterRegex, urlJoin(pathDirectory, newName))
    //         //     }
    //         // })
    //     });

    //     // await (await notesCollection.find(subseqFilter).toArray()).forEach(async (document) => 
    //     // {
    //     //     notesCollection.updateOne({_id: document._id}, 
    //     //     {
    //     //         $set: 
    //     //         {
    //     //             "directory": document.directory.replace(filterRegex, urlJoin(pathDirectory, newName))
    //     //         }
    //     //     })
    //     // });

    //     return true;
    //     //#endregion
    // }

    public static async move(fileFullPath:string, targetFolder: string)
    {
        ensurePath(fileFullPath, ObjectType.File);
        ensurePath(targetFolder, ObjectType.Folder);
        if (await this.isNoteExist(fileFullPath) == false) throw new FileNotExistsError(fileFullPath);
        if (await FolderClass.isFolderExists(targetFolder) == false) throw new FolderNotFoundError(targetFolder);
        
        let oldParent = getNoteParent(fileFullPath);
        let newFullPath = fileFullPath.replace(oldParent, targetFolder);
        if (await this.isNoteExist(newFullPath)) throw new FileExistsError(getNoteParent(newFullPath), getNoteName(newFullPath));

        let noteDoc = await NoteModel.findOne(
        {
            directory: getNoteParent(fileFullPath),
            name: getNoteName(fileFullPath)
        });
        noteDoc.directory = getNoteParent(newFullPath);
        await noteDoc.save();
    }

    public static async delete(fileFullPath:string)
    {
        if (await this.isNoteExist(fileFullPath) == false) throw new FileNotExistsError(fileFullPath);
        let noteDoc = await NoteModel.findOne(
        {
            directory: getNoteParent(fileFullPath),
            name: getNoteName(fileFullPath)
        });
        await noteDoc.deleteOne();
    }

    public static async rename(fileFullPath:string, newName:string)
    {
        if (await this.isNoteExist(fileFullPath) == false) throw new FileNotExistsError(fileFullPath);
        ensureFileName(newName);
        ensurePath(fileFullPath, ObjectType.File);
        let fileParentFolder = getNoteParent(fileFullPath);
        let oldFileName = getNoteName(fileFullPath);

        let noteDoc = await NoteModel.findOne(
        {
            directory: fileParentFolder,
            name: oldFileName
        });
        noteDoc.name = newName;
        await noteDoc.save();
    }

    public async rename(newName:string) { await NoteClass.rename(this.getNoteFullPath(), newName); }

    public static async isNoteExist (fullPath:string):Promise<boolean>;
    public static async isNoteExist (directory:string, noteName:string): Promise<boolean>;
    public static async isNoteExist (directoryOrFullPath:string, noteName?:string)
    {
        let directory = "";
        let name = "";

        if (noteName == undefined) 
        {
            let fullPath = directoryOrFullPath;
            ensurePath(fullPath, ObjectType.File);
            directory = getNoteParent(fullPath);
            name = getNoteName(fullPath);
        }
        else 
        {
            ensurePath(directoryOrFullPath, ObjectType.Folder);
            directory = directoryOrFullPath; 
            name = noteName; 
        }

        return (await NoteModel.find({
            directory: directory,
            name: name
        })).length > 0;
    }

    public static async getNote(fullPath:string)
    {
        let noteDoc = await NoteModel.findOne({
            directory: getNoteParent(fullPath),
            name: getNoteName(fullPath)
        });

        if (noteDoc == undefined) throw new FileNotExistsError(fullPath);
        else return noteDoc;
    }

    /**
     * Rename a note in a given path.
     * @param {*} pathDirectory 
     * @param {*} newName
     * @throws Will throw error if the path directory already contains a note with the same name, or the given name is not found.
     */
    // public async renameNote (pathDirectory:string, newName:string)
    // {   
    //     let oldName = this.name;
    //     let directoryToBeSaved = urlJoin(pathDirectory, "/")
    //     let isNameUsed = await NoteClass.isNoteExist(directoryToBeSaved, newName);
    //     let self = NoteModel.findOne(
    //     {
    //         name: this.name,
    //         directory: this.directory,
    //         type: "note"
    //     });

    //     if (isNameUsed) throw new FileExistsError(pathDirectory, newName);
    //     else if (await NoteClass.isNoteExist(directoryToBeSaved, oldName) == false) throw new FileNotExistsError(pathDirectory, oldName);

    //     self.name = sanitize(newName);
    //     await self.save();

    //     return self;
    // }

    // public static async listDirectory(folderPath: string): Promise<File[]>
    // {
    //     let path = folderPath;
    //     if (!path.endsWith("/")) path += "/";

    //     return (await NoteModel.find(
    //     {
    //         directory: path,
    //     })).map(x => 
    //     {
    //         return {
    //             directory: x.directory,
    //             type: x.type,
    //             name: x.name,
    //         } as File;
    //     });
    // }
}
export const NoteModel = getModelForClass(NoteClass);

// @modelOptions ( { schemaOptions: { autoCreate: false , _id : false, collection: "images" }, existingConnection:dbMongoose } )
// export class ImageClass
// {
//     @prop({required:true})
//     public _id!: string;

//     @prop({required:true})
//     public base64!: string;
// }
// export const ImageModel = getModelForClass(ImageClass);
