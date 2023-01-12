var expressInstance = undefined;
var socketIoInstance = undefined;
const { logGreen, logRed, log, logBlue, getLog } = require(`./extendedLog.js`);
const databaseOperations = require(`./databaseOperations.js`);
const auth = require("./auth.js");

async function checkReqSession(reqObject, resObject)
{
    var token = reqObject.headers[`authorization`];
    var username = reqObject.headers[`auth-username`];
    if (!await auth.isSessionMatch(token, username)) { resObject.status(401); resObject.end(); return false; }
    return true;
}

module.exports = async function (app, io)
{
    expressInstance = app;
    socketIoInstance = io;

    setEndpoint("/listDir", "GET", async (req, res, next) => 
    {
        var queryPath = decodeURIComponent(req.query.path);

        if (!await checkReqSession(req,res)) { return; }

        res.json(await databaseOperations.queryNotesCollection({ directory: queryPath }));
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
    setEndpoint("/uploadImage", "POST", async (req,res,next) => 
    {
        var postBody = req.body;
        var imageBase64 = postBody.imageBase64;

        if (!await checkReqSession(req,res)) { return; }

        if (imageBase64 == undefined || imageBase64 == null) res.status(400);
        var newDocId = (await databaseOperations.uploadImage(imageBase64));
        res.json({id:newDocId});
    });

    setEndpoint("/createFolder", "POST", async (req, res, next) => 
    {
        var folderName = req.body.name;
        var queryPath = decodeURIComponent(req.body.path);
        var socketIOClientID = req.body.socketIoId;

        if (!await checkReqSession(req,res)) { return; }

        if (folderName == undefined || queryPath == undefined)
        {
            res.status(422);
            res.end();
            return;
        }

        databaseOperations.createFolder(queryPath, folderName)
        .then((data) => 
        {
            res.status(200);
            res.json(data);

            socketIoInstance.emit("directoryChanged", 
            {
                "path": queryPath,
                "socketIdSource": socketIOClientID
            });

            return;
        })
        .catch(error => 
        {
            res.status(400);
            res.json(error);
            return;
        });
    })

    setEndpoint("/createNote", "POST", async (req, res, next) => 
    {
        var socketIOClientID = req.body.socketIoId;
        var noteName = req.body.name;
        var queryPath = decodeURIComponent(req.body.path);
        
        if (!await checkReqSession(req,res)) { return; }

        if (noteName == undefined || queryPath == undefined)
        {
            res.status(422);
            res.end();
            return;
        }

        databaseOperations.createNote("# **New Note**", queryPath, noteName)
        .then((data) => 
        {
            res.status(200);
            res.json(data);

            socketIoInstance.emit("directoryChanged", 
            {
                "path": queryPath,
                "socketIdSource": socketIOClientID
            });

            return;
        })
        .catch(error => 
        {
            res.status(400);
            res.json(error);
            return;
        });
    });

    setEndpoint("/updateNote", "POST", async (req, res, next) => 
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

    setEndpoint("/renameNote", "POST", async (req, res, next) => 
    {
        var socketIOClientID = req.body.socketIoId;
        var noteName = req.body.oldName;
        var newName = req.body.newName;
        var queryPath = decodeURIComponent(req.body.path);

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
        else if (queryPath == undefined)
        {
            res.status(422);
            res.json({message: "queryPath cannot be undefined."});
            return;
        }

        databaseOperations.renameNote(queryPath, noteName, newName)
        .then((data) => 
        {
            res.status(200);
            res.json(data);

            socketIoInstance.emit("directoryChanged", 
            {
                "path": queryPath,
                "name": noteName,
                "type": "note",
                "socketIdSource": socketIOClientID
            });

            socketIoInstance.emit("noteRenamed", 
            {
                "path": queryPath,
                "oldName": noteName,
                "newName": newName,
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

    setEndpoint("/renameFolder", "POST", async (req, res, next) => 
    {
        var socketIOClientID = req.body.socketIoId;
        var folderName = req.body.oldName;
        var newName = req.body.newName;

        if (!await checkReqSession(req,res)) { return; }

        var queryPath = decodeURIComponent(req.body.path);

        if (folderName == undefined)
        {
            res.status(422);
            res.json({message: "folderName cannot be undefined."});
            return;
        }
        else if (newName == undefined)
        {
            res.status(422);
            res.json({message: "newName cannot be undefined."});
            return;
        }
        else if (queryPath == undefined)
        {
            res.status(422);
            res.json({message: "queryPath cannot be undefined."});
            return;
        }

        databaseOperations.renameFolder(queryPath, folderName, newName)
        .then((data) => 
        {
            res.status(200);
            res.json(data);

            socketIoInstance.emit("directoryChanged", 
            {
                "path": queryPath,
                "name": folderName,
                "type": "folder",
                "socketIdSource": socketIOClientID
            });

            socketIoInstance.emit("folderRenamed", 
            {
                "path": queryPath,
                "oldName": folderName,
                "newName": newName,
                "type": "folder",
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
    })

    setEndpoint("/register", "POST", async (req, res, next) => 
    {
        var username = req.body.username;
        var passwordRaw = req.body.password;
        auth.createAccount(username, passwordRaw)
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

    setEndpoint("/login", "POST", async (req,res,next) => 
    {
        var username = req.body.username;
        var passwordRaw = req.body.password;
        var result = await auth.login(username, passwordRaw);
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

    io.on('connection', (socket) => 
    {
        socket.on('disconnect', () => 
        {
            
        });
    });
}

// Methods definitions
function setEndpoint(path, method, callback, requireLocalhost)
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