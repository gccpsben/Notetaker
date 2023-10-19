import * as Express from 'express';
import { port } from '.';
import { logGreen, logRed, log } from './extendedLog';
import * as auth from './auth';
import * as socketIO from 'socket.io';
import { mongoose } from '@typegoose/typegoose';
import { FolderClass } from './folder';
import { ObjectType, ensurePath, getFolderParent } from './path';
import { FileNotExistsError, NoteClass, NoteModel } from './note';
// import * as databaseOperations from './databaseOperations';

let expressInstance = undefined;
var socketIoInstance = undefined;
const databaseOperations = require(`./databaseOperations.js`);

async function checkReqSession(reqObject, resObject)
{
    var token = reqObject.headers[`authorization`];
    var username = reqObject.headers[`auth-username`];
    if (!await auth.AccountClass.isSessionMatch(token, username)) { resObject.status(401); resObject.end(); return false; }
    return true;
}

export async function returnError(res:Express.Response, err:Error) { res.status(400).json(err); }

export async function init(app:Express.Express, io:socketIO.Server)
{
    expressInstance = app;
    socketIoInstance = io;

    setEndpoint("/api/listDir", "GET", async (req:Express.Request, res:Express.Response, next) => 
    {
        try
        {
            let queryPath = decodeURIComponent(req.query?.path.toString());
            if (!await checkReqSession(req,res)) return;
            let allFiles = await FolderClass.getFolderChildren(queryPath);
            res.json(allFiles.map(file => { return { ...file, type: ObjectType[file.type] } }));
        }
        catch(ex) { returnError(res,ex); }
    });

    setEndpoint("/api/openNote", "GET", async (req:Express.Request, res:Express.Response, next) => 
    {
        try
        {
            if (!await checkReqSession(req,res)) return;
            let queryPath = decodeURIComponent(req.query?.path.toString());
            res.json(await NoteModel.getNote(queryPath));
        }
        catch(ex) { returnError(res,ex); }
    });

    setEndpoint("/api/updateNote", "POST", async (req:Express.Request, res:Express.Response, next) => 
    {
        try
        {
            if (!await checkReqSession(req,res)) return;
            let queryPath = decodeURIComponent(req.query?.path.toString());
            let queryContent = req.body?.content;
            if (queryContent === undefined) throw new Error("Body with a 'content' field must be provided.");
            let noteDoc = await NoteClass.getNote(queryPath);
            noteDoc.content = queryContent;
            await noteDoc.save();
            res.json({});
        }
        catch(ex) { returnError(res,ex); }
    });


    setEndpoint("/i/*", "GET", async (req,res,next) => 
    {
        var idRequested = req.path.replace("/i/", "");
        (databaseOperations.getImage(idRequested))
        .then(base64String => 
        {
            if (base64String == undefined) { res.status(404); res.end(); }
            else 
            {
                var img = Buffer.from(base64String, 'base64');
    
                res.writeHead(200, 
                {
                    'Content-Type': 'image/png',
                    'Content-Length': img.length
                });
                res.end(img);
            } 
        })
        .catch(error =>
        {
            res.status(404);
            res.end();
        }); 
    });

    // expect a JSON document
    setEndpoint("/api/uploadImage", "POST", async (req,res,next) => 
    {
        var postBody = req.body;
        var imageBase64 = postBody.imageBase64;

        if (!await checkReqSession(req,res)) { return; }

        if (imageBase64 == undefined || imageBase64 == null) res.status(400);
        var newDocId = (await databaseOperations.uploadImage(imageBase64));
        res.json({id:newDocId});
    });

    setEndpoint("/api/createFolder", "POST", async (req, res, next) => 
    {
        let folderName = decodeURIComponent(req.body.name);
        let queryPath = decodeURIComponent(req.body.path);
        let socketIOClientID = req.body.socketIoId;

        if (!await checkReqSession(req,res)) { return; }

        if (folderName == undefined || queryPath == undefined)
        {
            res.status(422);
            res.end();
            return;
        }

        FolderClass.createFolder(queryPath, folderName)
        .then(() => 
        {
            res.status(200);
            res.json({});

            socketIoInstance.emit("directoryChanged", 
            {
                "path": queryPath,
                "socketIdSource": socketIOClientID
            });

            return;
        })
        .catch(error => { returnError(res, error); });
    })

    setEndpoint("/api/createNote", "POST", async (req, res, next) => 
    {
        let socketIOClientID = req.body.socketIoId;
        let noteName = req.body.name;
        let queryPath = decodeURIComponent(req.body.path);
        
        if (!await checkReqSession(req,res)) { return; }

        if (noteName == undefined || queryPath == undefined)
        {
            res.status(422);
            res.end();
            return;
        }

        NoteClass.createNewNote("# **New Note**", queryPath, noteName).then(() => 
        {
            res.status(200).json({});

            socketIoInstance.emit("directoryChanged", 
            { 
                "path": queryPath,
                "socketIdSource": socketIOClientID 
            });

            return;
        })
        .catch(error => { returnError(res, error); });
    });

    setEndpoint("/api/updateNote", "POST", async (req, res, next) => 
    {
        var socketIOClientID = req.body.socketIoId;
        var noteName = req.body.name;
        var queryPath = decodeURIComponent(req.body.path);
        var newContent = (req.body.content);

        if (!await checkReqSession(req,res)) { return; }

        if (noteName == undefined)
        {
            res.status(422);
            res.json({message: "noteName cannot be undefined."});
            return;
        }
        else if (queryPath == undefined)
        {
            res.status(422);
            res.json({message: "queryPath cannot be undefined."});
            return;
        }
        else if (newContent == undefined)
        {
            res.status(422);
            res.json({message: "newContent cannot be undefined."});
            return;
        }

        databaseOperations.updateNote(newContent, queryPath, noteName)
        .then((data) => 
        {
            res.status(200);
            res.json(data);

            socketIoInstance.emit("fileChanged", 
            {
                "path": queryPath,
                "name": noteName,
                "type": "note",
                "socketIdSource": socketIOClientID
            });

            return;
        })
        .catch(error => 
        {
            res.status(400);
            log(error);
            res.json(error);
            return;
        });
    });

    setEndpoint("/api/renameNote", "POST", async (req, res, next) => 
    {
        let socketIOClientID = req.body.socketIoId;
        let noteName = req.body.oldFullPath;
        let newName = req.body.newName;

        if (!await checkReqSession(req,res)) { return; }

        if (noteName == undefined)
        {
            res.status(422);
            res.json({message: "noteName cannot be undefined."});
            return;
        }
        else if (newName == undefined)
        {
            res.status(422);
            res.json({message: "newName cannot be undefined."});
            return;
        }

        let note = await NoteClass.getNote(noteName);
        NoteClass.rename(noteName, newName)
        .then(() => 
        {
            socketIoInstance.emit("directoryChanged", 
            { 
                "path": note.directory,
                "socketIdSource": socketIOClientID 
            });

            socketIoInstance.emit("noteRenamed", 
            { 
                "oldFullPath": noteName,
                "newFullPath": note.directory + newName,
                "newNoteName": newName,
                "socketIdSource": socketIOClientID 
            });

            res.status(200);
            res.json({});
            res.end();
        })
        .catch(error => 
        {
            res.status(400);
            log(error);
            res.json(error);
            return;
        });
    });

    setEndpoint("/api/renameFolder", "POST", async (req, res, next) =>
    {
        let socketIOClientID = req.body.socketIoId;
        let folderPath = req.body.oldFullPath;
        let newName = req.body.newName;

        if (!await checkReqSession(req,res)) { return; }

        if (folderPath == undefined)
        {
            res.status(422);
            res.json({message: "folderPath cannot be undefined."});
            return;
        }
        else if (newName == undefined)
        {
            res.status(422);
            res.json({message: "newName cannot be undefined."});
            return;
        }

        FolderClass.rename(folderPath, newName)
        .then(() => 
        {
            socketIoInstance.emit("directoryChanged", 
            { 
                "path": getFolderParent(folderPath) + "/",
                "socketIdSource": socketIOClientID 
            });

            socketIoInstance.emit("folderRenamed", 
            { 
                "oldFullPath": folderPath,
                "newFullPath": getFolderParent(folderPath) + newName + "/",
                "newFolderName": newName,
                "socketIdSource": socketIOClientID 
            });

            res.status(200);
            res.json({});
            res.end();
        })
        .catch(error => { returnError(res, error); });
    });

    // setEndpoint("/api/renameFolder", "POST", async (req, res, next) => 
    // {
    //     var socketIOClientID = req.body.socketIoId;
    //     var folderName = req.body.oldName;
    //     var newName = req.body.newName;

    //     if (!await checkReqSession(req,res)) { return; }

    //     var queryPath = decodeURIComponent(req.body.path);

    //     if (folderName == undefined)
    //     {
    //         res.status(422);
    //         res.json({message: "folderName cannot be undefined."});
    //         return;
    //     }
    //     else if (newName == undefined)
    //     {
    //         res.status(422);
    //         res.json({message: "newName cannot be undefined."});
    //         return;
    //     }
    //     else if (queryPath == undefined)
    //     {
    //         res.status(422);
    //         res.json({message: "queryPath cannot be undefined."});
    //         return;
    //     }

    //     databaseOperations.renameFolder(queryPath, folderName, newName)
    //     .then((data) => 
    //     {
    //         res.status(200);
    //         res.json(data);

    //         socketIoInstance.emit("directoryChanged", 
    //         {
    //             "path": queryPath,
    //             "name": folderName,
    //             "type": "folder",
    //             "socketIdSource": socketIOClientID
    //         });

    //         socketIoInstance.emit("folderRenamed", 
    //         {
    //             "path": queryPath,
    //             "oldName": folderName,
    //             "newName": newName,
    //             "type": "folder",
    //             "socketIdSource": socketIOClientID
    //         });

    //         return;
    //     })
    //     .catch(error => 
    //     {
    //         res.status(400);
    //         log(error);
    //         res.json(error);
    //         return;
    //     });
    // })

    setEndpoint("/api/register", "POST", async (req: Express.Request, res: Express.Response, next) => 
    {
        let username = req.body.username;
        let passwordRaw = req.body.password;
        let userAgent = req.headers['user-agent'];
        let ip = req.socket.remoteAddress;

        auth.AccountClass.register(username, passwordRaw, userAgent, ip)
        .then(result => 
        {
            if (result == undefined) { res.status(401); res.end(); }
            else { res.json( { token: result } ); res.end(); }
        })
        .catch(() =>
        {
            res.status(401); res.end();
        });
    });

    setEndpoint("/api/login", "POST", async (req: Express.Request, res: Express.Response, next) => 
    {
        let username = req.body.username;
        let passwordRaw = req.body.password;
        let userAgent = req.headers['user-agent'];
        let ip = req.socket.remoteAddress;

        var result = await auth.AccountClass.login(username, passwordRaw, userAgent, ip);
        if (result == undefined)  { res.status(401); res.end(); }
        else { res.json( { token: result } ); res.end(); }
    });

    // setEndpoint("/", "GET", async (req,res,next) => 
    // {
    //     log("GET");
    //     if(req.headers["x-forwarded-proto"] === "https")
    //     {
    //         // OK, continue
    //         return next();
    //     };
    //     res.redirect('https://' + req.hostname + req.url);
    // })

    logGreen("Injected express endpoints");

    /** 
     * Users must connect the socket with auth: { username:..., token: ... },
     * otherwise the websocket will disconnect upon creation.
     */
    io.use(async function(socket, next)
    {
        let token = socket.handshake.auth?.token?.toString() ?? "";
        let username = socket.handshake.auth?.username?.toString() ?? "";
        let passed = false;
        let notEmpty = (x:string) => x && x.trim() != "";

        if (notEmpty(token) && notEmpty(username))
        {
            if (await auth.AccountClass.isSessionMatch(token, username)) passed = true;
        }

        if (!passed) next(new Error('Authentication error'));
        else next();
    });

    io.on('connection', (socket) => 
    {
        console.log("someone connected");
        socket.on('disconnect', () => 
        {
            
        });
    });
}

// Methods definitions
function setEndpoint(path:string, method:string, callback:any, requireLocalhost:boolean = false)
{
    if (!callback) { console.warn("callback is null."); return; }
    if (!path) { console.warn("path is null."); return; }

    expressInstance[method.toLowerCase()](path, function (req, res, next)
    {
        var acceptedSource = 
        [
            "::1",
            "::ffff:127.0.0.1",
            "localhost"
        ];

        // Handle access of local resources from remote.
        if (!acceptedSource.includes(req.connection.remoteAddress) && requireLocalhost)
        {
            logRed(`Requests of "${path}" from ${req.connection.remoteAddress} was rejected.`);
            res.status(403).send(`<html><body>Access denied. Access must originate from <a href='http://localhost:${port}/accessRecordRaw'>localhost</a>. Current source: ${req.connection.remoteAddress}</body></html>`); 
        }
        else callback(req, res, next); 
    });
}