var sanitize = require('mongo-sanitize');

'use strict'

class FileExistsError extends Error 
{
    constructor(directory, fileName) 
    {
        var m = `'${fileName}' already exist in ${directory}`;
        super();
        this.name = "FileExistsError";
        this.message = m;
    }
}
class FileNotExistsError extends Error 
{
    constructor(directory, fileName) 
    {
        var m = `'${fileName}' is not present in ${directory}`;
        super();
        this.name = "FileNotExistsError";
        this.message = m;
    }
}

const { logGreen, logRed, log, logBlue, getLog } = require(`./extendedLog.js`);
const MongoClient = require(`mongodb`);
var dbClient = undefined;
var dbInstance = undefined;
const {urlJoin} = require(`./pathJoin.js`);
const dbNames = 
{
    "notesCollection":
    {
        name: "Notes",
        collectionInstance: undefined
    }
};

module.exports = async (connectionUrlString) =>
{
    dbClient = new MongoClient.MongoClient(connectionUrlString);
    await dbClient.connect();
    dbInstance = dbClient.db();
    await dbInstance.command({ ping: 1 }); // Establish and verify connection
    dbNames["notesCollection"].collectionInstance = await dbInstance.collection("Notes");
    logGreen("Connected to database.");
    module.exports.dbInstance = dbInstance;
}

module.exports.isNoteExist = async (directory, noteName) => 
{
    // find notes with the same name, in the same path
    var obj = (await (dbNames["notesCollection"].collectionInstance.find(
    {
        type: "note",
        directory: sanitize(directory),
        name: sanitize(noteName)
    }))).toArray();

    var found = (await obj).length != 0;
    return found;
}

module.exports.isFolderExist = async (directory, noteName) => 
{
    // find notes with the same name, in the same path
    var obj = (await (dbNames["notesCollection"].collectionInstance.find(
    {
        type: "folder",
        directory: sanitize(directory),
        name: sanitize(noteName)
    }))).toArray();

    var found = (await obj).length != 0;
    return found;
}

module.exports.uploadImage = async (base64) =>
{
    var documentBody = 
    {
        base64: base64
    };
    var doc = await dbInstance.collection("images").insertOne(documentBody);
    return doc.insertedId;
}

module.exports.getImage = async (id) => 
{
    try 
    {
        var document = await dbInstance.collection("images").find({_id:new MongoClient.ObjectId(id)}).toArray();
        if (document.length == 0) throw new Error("Cannot find the document.");
        return document[0].base64;
    }
    catch(e) { throw e; }
};

module.exports.updateNote = async (newContent, directory, noteName) =>
{
    const filter = 
    {
        name: sanitize(noteName),
        type: sanitize("note"),
        directory: sanitize(directory)
    };

    const query = 
    { 
        "$set":
        {
            content: sanitize(newContent)
        }
    }

    return await dbNames["notesCollection"].collectionInstance.updateOne(filter, query);
}

/**
 * 
 * @param {string} pathDirectory 
 * @param {string} name 
 * @returns 
 */
 module.exports.isFolderDuplicate = async (pathDirectory, name) =>
 {
     // find folders with the same name, in the same path
     var duplicateObjects = (await (dbNames["notesCollection"].collectionInstance.find(
     {
        type: "folder",
        directory: sanitize(pathDirectory),
        name: sanitize(name)
     }))).toArray();
 
     var duplicateFound = (await duplicateObjects).length != 0;
     return duplicateFound;
 }

/**
 * 
 * @param {string} pathDirectory 
 * @param {string} name 
 * @returns 
 */
module.exports.isNoteDuplicate = async (pathDirectory, name) =>
{
    // find notes with the same name, in the same path
    var duplicateObjects = (await (dbNames["notesCollection"].collectionInstance.find(
    {
        type: "note",
        directory: sanitize(pathDirectory),
        name: sanitize(name)
    }))).toArray();

    var duplicateFound = (await duplicateObjects).length != 0;
    return duplicateFound;
}

/**
 * Create a new note in given path.
 * @param {*} content 
 * @param {*} pathDirectory 
 * @param {*} name 
 * @returns {*} the newly added document body
 * @throws Will throw error if the path directory already contains a note with the same name.
 */
module.exports.createNote = async (content, pathDirectory, name) =>
{   
    var directoryToBeSaved = urlJoin(pathDirectory, "/")
    var duplicateFound = await module.exports.isNoteDuplicate(directoryToBeSaved, name);

    if (duplicateFound) throw new FileExistsError(pathDirectory, name);

    var documentBody = {
        type: "note",
        name: sanitize(name),
        directory: sanitize(directoryToBeSaved),
        content: sanitize(content)
    };

    await dbNames["notesCollection"].collectionInstance.insertOne(documentBody);
    return documentBody;
}

/**
 * Rename a note in a given path.
 * @param {*} pathDirectory 
 * @param {*} oldName
 * @param {*} newName
 * @throws Will throw error if the path directory already contains a note with the same name, or the given name is not found.
 */
 module.exports.renameNote = async (pathDirectory, oldName, newName) =>
 {   
    var directoryToBeSaved = urlJoin(pathDirectory, "/")
    var isNameUsed = await module.exports.isNoteDuplicate(directoryToBeSaved, newName);

    if (isNameUsed) throw new FileExistsError(pathDirectory, newName);
    else if (await module.exports.isNoteExist(directoryToBeSaved, oldName) == false) throw new FileNotExistsError(pathDirectory, oldName);

    const filter = 
    {
        name: sanitize(oldName),
        type: sanitize("note"),
        directory: sanitize(directoryToBeSaved)
    };

    const query = 
    { 
        "$set":
        {
            name: sanitize(newName)
        }
    }

    return await dbNames["notesCollection"].collectionInstance.updateOne(filter, query);
 }



 /**
 * Rename a folder in a given path.
 * @param {*} pathDirectory 
 * @param {*} oldName
 * @param {*} newName
 * @throws Will throw error if the path directory already contains a folder with the same name, or the given name is not found.
 */
module.exports.renameFolder = async (pathDirectory, oldName, newName) =>
{   
    var directoryToBeSaved = urlJoin(pathDirectory, "/")
    var isNameUsed = await module.exports.isFolderDuplicate(directoryToBeSaved, newName);
    var notesCollection = dbNames["notesCollection"].collectionInstance;

    if (isNameUsed) throw new FileExistsError(pathDirectory, newName);
    else if (await module.exports.isFolderExist(directoryToBeSaved, oldName) == false) throw new FileNotExistsError(pathDirectory, oldName);

    //#region Update folder name of the folder object
    const initFilter = 
    {
        name: sanitize(oldName),
        type: sanitize("folder"),
        directory: sanitize(directoryToBeSaved)
    };

    const initQuery = { "$set": { name: sanitize(newName) } }

    await notesCollection.updateOne(initFilter, initQuery);
    //#endregion

    //#region Update the path of all files in the folder
    //var filterRegex = new RegExp(`/^${urlJoin(pathDirectory,oldName).replace('/','\\/')}/`);
    var inner = urlJoin(pathDirectory,oldName);
    var filterRegex =  new RegExp(`^\\${inner}`);
    const subseqFilter = 
    {
        directory: filterRegex
    };

    await (await notesCollection.find(subseqFilter).toArray()).forEach(async (document) => 
    {
        notesCollection.updateOne({_id: document._id}, 
        {
            $set: 
            {
                "directory": document.directory.replace(filterRegex, urlJoin(pathDirectory, newName))
            }
        })
    });

    return true;
    //#endregion
}

/**
 * Create a new folder in given path.
 * @param {*} pathDirectory 
 * @param {*} name 
 * @throws Will throw error if the path directory already contains a folder with the same name.
 */
 module.exports.createFolder = async (pathDirectory, name) =>
 {   
    var directoryToBeSaved = urlJoin(pathDirectory, "/")
    var duplicateFound = await module.exports.isFolderDuplicate(directoryToBeSaved, name);

    if (duplicateFound) throw new FileExistsError(pathDirectory, name);

    var documentBody = {
        type: "folder",
        name: sanitize(name),
        directory: sanitize(directoryToBeSaved)
    };

    await dbNames["notesCollection"].collectionInstance.insertOne(documentBody);
    return documentBody;
 }

module.exports.queryNotesCollection = async (options, method="find") =>
{
    return await dbNames["notesCollection"].collectionInstance[method](options).toArray();
}