const { MongoExpiredSessionError, ObjectId } = require("mongodb");
var db = require("./databaseOperations");
const crypto = require("crypto");
const bcrypt = require('bcrypt');
const saltRounds = 10;

module.exports.isUsernamePass = async function (usernameRaw) 
{
    if (!usernameRaw) return false;
    if (typeof (usernameRaw) != "string") return false;
    if (usernameRaw.length <= 3 || usernameRaw.length >= 20) return false;
    if (/^[a-zA-Z0-9_]*$/g.test(usernameRaw) == false) return false;
    var accWithSameName = await getAccDocByUsername(usernameRaw);
    if (accWithSameName != undefined) return false;
    return true;
}

module.exports.isPasswordPass = function (passwordRaw) 
{
    if (!passwordRaw) return false;
    if (typeof (passwordRaw) != "string") return false;
    if (passwordRaw.length <= 3 || passwordRaw.length >= 40) return false;
    return true;
}

// return a token in string if sucessful, and return error if failed.
module.exports.createAccount = async function (usernameRaw, pwRaw)
{   
    if (await module.exports.isUsernamePass(usernameRaw) == false) throw new Error("Username doesn't pass");
    else if (!module.exports.isPasswordPass(pwRaw)) throw new Error("Password doesn't pass");
    var hashedPassword = await bcrypt.hash(pwRaw, saltRounds);
    await db.dbInstance.collection("accounts").insertOne(
    {
        username: usernameRaw,
        passwordHash: hashedPassword,
        sessions: []
    });
    var l = await module.exports.login(usernameRaw, pwRaw);
    console.log(l);
    return l;
}

module.exports.isSessionMatch = async function (tokenString, usernameRaw)
{
    if (!tokenString) return false;
    var accDoc = (await getAccDocByUsername(usernameRaw));
    if (accDoc == undefined) { return false; }
    return accDoc.sessions.includes(tokenString);
}

// return a token in string if passed, return undefined if failed.
module.exports.login = async function (usernameRaw, pwRaw)
{
    try
    {
        var accDoc = await getAccDocByUsername(usernameRaw);
        if (accDoc == undefined) return undefined;
        if (await bcrypt.compare(pwRaw, accDoc.passwordHash) == false) return undefined;
        else 
        {
            var token = crypto.randomUUID();
            await db.dbInstance.collection("accounts").updateOne(
            {
                _id: new ObjectId(accDoc._id)
            }, 
            {
                "$set":
                {
                    sessions: [...accDoc.sessions ?? [], token]
                }
            })
            return token;
        }
    }
    catch(e) { console.log(e); return undefined; }
}

async function getAccDocByUsername (username)
{
    var docs = await db.dbInstance.collection("accounts").find({username: username}).toArray();
    if (docs.length == 0) return undefined;
    else return docs[0];
}