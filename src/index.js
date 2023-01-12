'use strict'

//#region Library Imports
const { logGreen, logRed, log, logBlue, getLog } = require(`./extendedLog.js`);
const Express = require(`express`);
const https = require(`https`);
const process = require(`process`);
const urlJoin = require(`./pathJoin.js`);
const fs = require(`fs`);
const path = require(`path`);
const dotenv = require(`dotenv`);
const dbOperations = require(`./databaseOperations.js`);
const endpoints = require(`./endpoints.js`);
const { Server } = require("socket.io");
const minify = require('express-minify');
dotenv.config("../.env") // load ./.env
//#endregion

//#region SSL
var key = fs.readFileSync(process.cwd() + '/ssl/emdt.ddns.net.key')
var cert = fs.readFileSync(process.cwd() + '/ssl/emdt_ddns_net.pem-chain')
//#endregion 

//#region Parameters
const app = Express();
const server = https.createServer( { key:key, cert:cert },app);
const io = new Server(server);
const port = process.env.PORT || 55558;
const fullDatabaseUrl = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_URL}`;
app.use(minify());
app.use(Express.json());
app.use(Express.static("./public/", {index: "index.html"}));
//#endregion

//#region Initialization
log(`Connecting to ${process.env.DB_URL}...`);
dbOperations(fullDatabaseUrl, process.env.DB_NAME).then(() => {endpoints(app, io)});
//#endregion

server.listen(port, () => { logGreen(`Started listening on ${port}`); });