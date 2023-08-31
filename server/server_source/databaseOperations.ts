'use strict'
import { mongoose } from '@typegoose/typegoose';
import { NoteClass, NoteModel } from './note';
import { FolderClass, FolderModel } from './folder';
import { printTree, validateTree } from './tree';
import { logGreen, logRed, logYellow } from './extendedLog';

export let dbMongoose = undefined;
export async function init (connectionUrlString:string)
{
    dbMongoose = mongoose.connect(connectionUrlString, {dbName: "dev"});
    logYellow("Validating file tree...");
    
    if (await validateTree()) logGreen(`Tree clean. ${(await FolderModel.find()).length} folders and ${(await NoteModel.find()).length} notes found!`);
    else logRed(`Tree is corrupted.`);

    // dbClient = new MongoClient.MongoClient(connectionUrlString);
    // await dbClient.connect();
    // dbInstance = dbClient.db();
    // await dbInstance.command({ ping: 1 }); // Establish and verify connection
    // dbNames["notesCollection"].collectionInstance = await dbInstance.collection("Notes");
    // logGreen("Connected to database.");
    // dbInstance = dbInstance; 
    // dbMongoose = mongoose.connmect();
    
    // logGreen("Will backup every 12 hours...");
    // setInterval(() => { backup(); }, 60000 * 60 * 12);

    // console.log((await NoteClass.listDirectory("")));
     
    // await FolderClass.createFolder("/root/folderNameHere/folderNameHere/", "folderNameHere"); 

    // await NoteClass.createNewNote("#test", "/root/folderNameHere/", "NOTE");

    // Hard reset
    // await FolderModel.deleteMany({});
    // await NoteModel.deleteMany({});
    // await FolderClass.emptyFolder("/root/");
    // await FolderClass.createFolder("/root/", "Crypto");
    // await FolderClass.createFolder("/root/", "New Crypto");
    // await NoteClass.createNewNote("#", "/root/Crypto/", "Note Crypto");
    // await NoteClass.createNewNote("#", "/root/New Crypto/", "Note New Crypto");
    // console.log("==========BEFORE===========");
    // await printTree();
    // console.log(await validateTree()); 
    // console.log("===========================");

    // await FolderClass.emptyFolder("/root/");
    // await FolderClass.createFolder("/root/", "Crypto");
    // await FolderClass.createFolder("/root/Crypto/", "Bitcoin");
    // await NoteClass.createNewNote("#", "/root/Crypto/", "Crypto Note");
    // await NoteClass.createNewNote("#", "/root/Crypto/Bitcoin/", "Bitcoin Note");
    // await FolderClass.createFolder("/root/Crypto/", "ETH");
    // await NoteClass.createNewNote("#", "/root/Crypto/ETH/", "ETH Note");
    // await FolderClass.createFolder("/root/", "New Crypto"); 

    // await FolderClass.deleteFolder("/root/");
    // await FolderClass.createFolder("/root/", "School");
    // await NoteClass.createNewNote("#", "/root/School/Secondary School/English/", "All Words");
    // await FolderClass.moveFolder("/root/University/", "/root/University/GE/");
    // await FolderClass.emptyFolder("/root/");
    // await FolderClass.moveFolder(`/root/Copium Market/BTC/`, `/root/`);
    // await FolderClass.rename("/root/BTC/", "Bitcoin"); 
    // await FolderClass.emptyFolder("/root/");

    // await FolderClass.deleteFolder("/root/Crypto/Bitcoin/");
    // await FolderClass.rename("/root/Crypto/ETH/", "ETH Note");
    // await FolderClass.moveFolderContent("/root/Crypto/", "/root/New Crypto/");

    // await FolderClass.createFolder("/root/", "Folder 1");
    // await FolderClass.createFolder("/root/", "Folder 2");
    // await NoteClass.createNewNote("#", "/root/Folder 1/", "note 1");
    // await NoteClass.createNewNote("#", "/root/Crypto/Bitcoin/", "Bitcoin Note");

    // await NoteClass.rename("/root/Folder 1/note 1", "note 2");
    // await FolderClass.moveFolderContent("/root/Crypto/Bitcoin/", "/root/Crypto/");

    // await NoteClass.rename("/root/Copium Market/BTC/Bitcoin Note", "BTC Note");
    // await FolderClass.moveFolder("/root/New Crypto/Bitcoin/", "/root/");
    // await FolderClass.moveFolder("/root/Bitcoin/", "/root/Bitcoin/New Crypto/");

    // await FolderClass.deleteFolder(`/root/Crypto/`);
    // console.log(await FolderClass.getFolderDescendants("/root/Crypto/Bitcoin/"));

    // await NoteClass.createNewNote("#", "/root/Crypto/", "Main Note Crypto"); 
    // await FolderClass.moveFolder("/root/Crypto/", "/root/New Crypto/"); 

    // console.log("========== AFTER===========");
    // await printTree();
    // console.log(await validateTree()); 
    // console.log("===========================");

    
    // await FolderClass.moveFolder("/root/folderNameHere/", "/root/newFolderDeep/");

    // console.log(await FolderClass.isFolderExists("/root/folderNameHereqwe/"));
    // await NoteClass.createNewNote("CONTENT HERE", "/root/", "testing note"); 
}

// export async function getImage (id)
// {
//     try 
//     {
//         var document = await dbInstance.collection("images").find({_id:new MongoClient.ObjectId(id)}).toArray();
//         if (document.length == 0) throw new Error("Cannot find the document.");
//         return document[0].base64;
//     }
//     catch(e) { throw e; }
// };

// export async function uploadImage (base64)
// {
//     var documentBody = 
//     {
//         base64: base64
//     };
//     var doc = await dbInstance.collection("images").insertOne(documentBody);
//     return doc.insertedId;
// }

// /**
//  * Create a new note in given path.
//  * @param {*} content 
//  * @param {*} pathDirectory 
//  * @param {*} name 
//  * @returns {*} the newly added document body
//  * @throws Will throw error if the path directory already contains a note with the same name.
//  */
// export async function createNote(content, pathDirectory, name)
// {   
//     var directoryToBeSaved = urlJoin(pathDirectory, "/")
//     var duplicateFound = await isNoteDuplicate(directoryToBeSaved, name);

//     if (duplicateFound) throw new FileExistsError(pathDirectory, name);

//     var documentBody = {
//         type: "note",
//         name: sanitize(name),
//         directory: sanitize(directoryToBeSaved),
//         content: sanitize(content)
//     };

//     await dbNames["notesCollection"].collectionInstance.insertOne(documentBody);
//     return documentBody;
// }

// /**
//  * Create a new folder in given path.
//  * @param {*} pathDirectory 
//  * @param {*} name 
//  * @throws Will throw error if the path directory already contains a folder with the same name.
//  */
// export async function createFolder (pathDirectory, name)
//  {   
//     var directoryToBeSaved = urlJoin(pathDirectory, "/")
//     var duplicateFound = await isFolderDuplicate(directoryToBeSaved, name);

//     if (duplicateFound) throw new FileExistsError(pathDirectory, name);

//     var documentBody = {
//         type: "folder",
//         name: sanitize(name),
//         directory: sanitize(directoryToBeSaved)
//     };

//     await dbNames["notesCollection"].collectionInstance.insertOne(documentBody);
//     return documentBody;
//  }

// export async function queryNotesCollection (options, method="find")
// {
//     return await dbNames["notesCollection"].collectionInstance[method](options).toArray();
// }

// export async function backup ()
// {
//     return fs.pathExists("./backup").then(async isExist => 
//     {
//         if (!isExist) 
//         {
//             log("./backup is not found. Creating folder...");    
//             await fs.mkdir("./backup");
//         }

//         var allCollectionNames = (await dbInstance.listCollections().toArray()).map(x => x.name);
//         var today = new Date();
//         var currentDate = `${today.getDate()}-${today.getMonth()+1}-${today.getFullYear()}`;
        
//         // if backup exists, skip
//         if (await fs.pathExists(`./backup/${currentDate}`)) 
//         { 
//             logGreen(`Backup for ${currentDate} already exists... skipping backup.`);
//             return; 
//         }
//         else await fs.mkdir(`./backup/${currentDate}`);

//         for (var i = 0; i < allCollectionNames.length; i++)
//         {
//             var jsonToSave = await dbInstance.collection(allCollectionNames[i]).find({}).toArray();
//             await fs.writeJSON(`./backup/${currentDate}/${allCollectionNames[i]}.json`, jsonToSave);
//         }

//         logGreen(`Backup for ${currentDate} created!`);
        
//     });
// }