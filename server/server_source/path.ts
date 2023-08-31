/*
    All notes in the database has a directory and name, and the root is "/"
    For example:
    
    root
    |
    +- Note 1
    +- Folder 1
       |
       +- Note 2
       +- Folder 2
          |
          + Note 3

    1) Rules: Path must starts with "/root/"
    2) Path for folders must end with "/", for example "/root/Folder1/Folder2/"
       "/root/Folder1/Folder2" points to a note named "Folder2" in Folder1 instead.
    3) No "//" allowed in path.
*/

import sanitize = require("mongo-sanitize");

export enum ObjectType
{
    File = 0,
    Folder = 1,
    Any = 2
}

export const bannedFileNameSymbols   = [":", "/", "$", "\\", "?", "<", ">"];
export const bannedFolderNameSymbols = [":", "/", "$", "\\", "?", "<", ">"];

class InvalidFileNameError extends Error 
{
    constructor(filename:string, message:string) 
    {
        var m = `'${filename}' is not a valid name for files. Reason: ${message}`;
        super();
        this.name = "InvalidFileNameError";
        this.message = m;
    }
}

class InvalidPathError extends Error 
{
    constructor(path:string, message:string) 
    {
        var m = `'${path}' is not a valid path. Reason: ${message}`;
        super();
        this.name = "InvalidPathError";
        this.message = m;
    }
}

class UnexpectedPathTypeError extends Error
{
    constructor(path:string, expectedType: ObjectType)
    {
        var m = `'${path}' is not a ${expectedType} path. Please use a ${expectedType} path.`;
        super();
        this.name = "UnexpectedPathTypeError";
        this.message = m;
    }
}

/**
 * Infer the type of path a given path is. Return InvalidPathError if the path is not valid.
 * @param path 
 * @returns 
 */
export function getPathType(path:string): ObjectType
{
    let pathValidation = validatePath(path);
    if (!pathValidation.isValid) throw new InvalidPathError(path, pathValidation.reason);
    if (path.endsWith('/')) return ObjectType.Folder;
    else return ObjectType.File;
}

export function ensureFileName(fileName:string)
{
    let containsBanned = !fileName.split('').every(charInPath => { return !bannedFileNameSymbols.includes(charInPath) });
    if (containsBanned) throw new InvalidFileNameError(fileName, "Filename contains banned symbols.");
    if (fileName.length == 0) throw new InvalidFileNameError(fileName, "Filename is empty.");
    if (sanitize(fileName) != fileName) throw new InvalidFileNameError(fileName, "Filename failed sanitization.");
}

export function ensureFolderName(folderName:string)
{
    let containsBanned = !folderName.split('').every(charInPath => { return !bannedFolderNameSymbols.includes(charInPath) });
    if (containsBanned) throw new InvalidFileNameError(folderName, "Folder name contains banned symbols.");
    if (folderName.length == 0) throw new InvalidFileNameError(folderName, "Folder name is empty.");
}

export function ensurePath(path:string, expectedType: ObjectType = ObjectType.Any): void
{
    let result = validatePath(path, expectedType);
    if (result.isValid == false) throw new InvalidPathError(path, result.reason);
}

/**
 * Check if a given string a in a correct format of path. Expected type can be provided to check for correct syntax for file path and folder path.
 * @param path 
 * @param expectedType 
 * @returns 
 */
export function validatePath(path: string, expectedType: ObjectType = ObjectType.Any): { isValid: boolean, reason:string | undefined }
{
    let reject = (_reason:string|undefined) => { return { isValid: false, reason: _reason } };
    let resolve = (_reason:string|undefined) => { return { isValid: true, reason: _reason } };
    
    if (typeof(path) != "string") return reject("Paths must be a type of string."); 
    if (!path.startsWith("/root/")) return reject("Paths must start with '/root/'.");
    if (path.includes("//")) return reject("Paths must not contain '//'.");
    if (path == "" || path == undefined || path == null) return reject("Empty paths are not allowed.");

    if (expectedType == ObjectType.File)
    {
        if (path.endsWith("/")) return reject("Filepaths must not end with '/'.");
    }
    else if (expectedType == ObjectType.Folder)
    {
        if (!path.endsWith("/")) return reject("Folder paths (directory) must end with '/'.");
    }

    return resolve(undefined);
}

/**
 * Get the note's name given a file path. Will throw UnexpectedPathTypeError if given a directory.
 * "/Folder1/Folder2/Note1" returns "Note1"
 * "/Folder1/" will throw errors
 */
export function getNoteName(filePath: string)
{
    ensurePath(filePath, ObjectType.Any);
    let pathType = getPathType(filePath);
    if (pathType != ObjectType.File) throw new UnexpectedPathTypeError(filePath, ObjectType.File);

    let parts = filePath.split("/");
    return parts[parts.length - 1];
}

/**
 * Return the folder name of a given directory.
 * @param folderPath 
 */
export function getFolderName(folderPath: string)
{
    ensurePath(folderPath, ObjectType.Any);
    let pathType = getPathType(folderPath);
    if (pathType != ObjectType.Folder) throw new UnexpectedPathTypeError(folderPath, ObjectType.Folder);

    let parts = folderPath.split("/");
    return parts[parts.length - 2];
}

/**
 * Return the full path of a folder's parent. Example: "/root/f1/f2/" returns "/root/f1/"
 * Notice that "/root/" returns "/"
 * @param folderPath 
 * @returns 
 */
export function getFolderParent(folderPath: string)
{
    ensurePath(folderPath, ObjectType.Any);
    let pathType = getPathType(folderPath);
    if (pathType != ObjectType.Folder) throw new UnexpectedPathTypeError(folderPath, ObjectType.Folder);

    let parts = folderPath.split("/");
    return parts.slice(0, -2).join("/") + "/";
}

/**
 * Return the full path of a note's parent. Example: "/root/f1/note" returns "/root/f1/"
 * Notice that "/root/note" returns "/root/"
 * @param folderPath 
 * @returns 
 */
export function getNoteParent(notePath: string)
{
    ensurePath(notePath, ObjectType.Any);
    let pathType = getPathType(notePath);
    if (pathType != ObjectType.File) throw new UnexpectedPathTypeError(notePath, ObjectType.File);

    let parts = notePath.split("/");
    parts = parts.slice(0,-1);
    return parts.join("/") + "/";
}

/**
 * Check if an object is a descendant of a folder. The object can be both file or folder.
 * @param folderPath 
 * @param objectPath 
 * @param skipPathCheck The folderPath and objectPath will not be validated if this is set to true.
 */
export function isPathInFolder(folderPath: string, objectPath: string, skipPathCheck: boolean = false)
{
    if (!skipPathCheck) ensurePath(folderPath, ObjectType.Folder);
    if (!skipPathCheck) ensurePath(objectPath);
    return objectPath.includes(folderPath);
}

/**
 * Walk through all the folders (and files) of a given path, and return them as a stirng array.
 * Will throw error if the path is not valid.
 */
export function walkPath(path:string)
{
    ensurePath(path);
    
    let parts = path.split("/");
    let cursor = "";
    let paths = [];
    let count = 0;
    for (let part of parts)
    {
        cursor += part + (count == parts.length - 1 ? "" : "/");
        count++;
        if (cursor == "/" || cursor == "/root/" || part == '') continue;
        paths.push(cursor);
    }
    return paths;
}

// // this is for server side
// function normalize (strArray) {
//     const resultArray = [];
//     if (strArray.length === 0) { return ''; }
  
//     if (typeof strArray[0] !== 'string') {
//       throw new TypeError('Url must be a string. Received ' + strArray[0]);
//     }
  
//     // If the first part is a plain protocol, we combine it with the next part.
//     if (strArray[0].match(/^[^/:]+:\/*$/) && strArray.length > 1) {
//       strArray[0] = strArray.shift() + strArray[0];
//     }
  
//     // There must be two or three slashes in the file protocol, two slashes in anything else.
//     if (strArray[0].match(/^file:\/\/\//)) {
//       strArray[0] = strArray[0].replace(/^([^/:]+):\/*/, '$1:///');
//     } else {
//       strArray[0] = strArray[0].replace(/^([^/:]+):\/*/, '$1://');
//     }
  
//     for (let i = 0; i < strArray.length; i++) {
//       let component = strArray[i];
  
//       if (typeof component !== 'string') {
//         throw new TypeError('Url must be a string. Received ' + component);
//       }
  
//       if (component === '') { continue; }
  
//       if (i > 0) {
//         // Removing the starting slashes for each component but the first.
//         component = component.replace(/^[\/]+/, '');
//       }
//       if (i < strArray.length - 1) {
//         // Removing the ending slashes for each component but the last.
//         component = component.replace(/[\/]+$/, '');
//       } else {
//         // For the last component we will combine multiple slashes to a single one.
//         component = component.replace(/[\/]+$/, '/');
//       }
  
//       resultArray.push(component);
  
//     }
  
//     let str = resultArray.join('/');
//     // Each input component is now separated by a single slash except the possible first plain protocol part.
  
//     // remove trailing slash before parameters or hash
//     str = str.replace(/\/(\?|&|#[^!])/g, '$1');
  
//     // replace ? in parameters with &
//     const parts = str.split('?');
//     str = parts.shift() + (parts.length > 0 ? '?': '') + parts.join('&');
  
//     return str;
//   }
  
// export function urlJoin (...args)
// {
//   const parts = Array.from(Array.isArray(args[0]) ? args[0] : args);
//   return normalize(parts);
// }