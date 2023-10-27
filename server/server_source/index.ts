'use strict'

//#region Library Imports
import { logGreen, logRed, log, logYellow } from "./extendedLog";
import * as process from 'process';
import * as Express from 'express';
import * as https from 'https'; 
import * as urlJoin from './path';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as dbOperations from './databaseOperations';
import * as endpoints from './endpoints';
import { Server } from 'socket.io';
import * as minify from 'express-minify';
import helmet from "helmet";
import cookieParser = require("cookie-parser");
dotenv.config("../.env" as any) // load ./.env
//#endregion

// #region SSL
export const isSSLDefined = process.env.SSL_KEY_PATH && process.env.SSL_PEM_PATH;
export let sslKey:Buffer|undefined, sslCert:Buffer|undefined;

if (!isSSLDefined) logYellow("SSL_KEY_PATH or SSL_PEM_PATH isn't defined in the env file. Running in HTTP mode.");
else 
{ 
    sslKey = fs.readFileSync(process.cwd() + process.env.SSL_KEY_PATH);
    sslCert = fs.readFileSync(process.cwd() + process.env.SSL_PEM_PATH);
    logGreen("Running in HTTPS mode.");
}
// #endregion 

//#region Parameters
export const isDevMode = process.env?.devMode == 'true';
export const publicFolderPath = require('node:path').resolve(process.env.DIST_PATH ?? "../dist");
export const app = Express();
app.use(cookieParser());
app.use(helmet(
{ 
    contentSecurityPolicy: false,
    
}));
export const server = isSSLDefined ? require('https').createServer({ key:sslKey, cert:sslCert }, app) : require('http').createServer(app);
export const io = new Server(server);
export const port = process.env.PORT || 55558;
export const fullDatabaseUrl = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_URL}`;
//#endregion

// Initialization
(async () => 
{
    if (isDevMode)
    {
        logYellow("");logYellow("");
        logYellow(`========= DEVELOPMENT MODE =========`);
        logYellow(`   process.env.devMode === true   `);
        logYellow("");logYellow("");
    }
    else logGreen(`Running in production mode`);
    
    log(`Connecting to ${process.env.DB_URL}...`);
    logGreen(`Static folder set to ${publicFolderPath}`);

    app.use(minify());
    app.use(Express.json({limit: '50mb'}));

    await dbOperations.init(fullDatabaseUrl);
    await endpoints.init(app, io)
    server.listen(port, () => { logGreen(`Started listening on ${port}`); });

    app.use(Express.static(publicFolderPath, { index: "index.html" }));
    app.get("/*", (req, res) => { res.sendFile("index.html", { root: publicFolderPath }); });
})();
