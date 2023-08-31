import * as db from './databaseOperations';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import { dbMongoose } from './databaseOperations';

const saltRounds = 10;
const sessionsExpireMs = 2.592e+9; // 30d

@modelOptions ( { schemaOptions: { autoCreate: false , _id:false }, existingConnection:dbMongoose } )
export class Token
{
    @prop({required:true, type: String})
    public token:string;

    @prop({required:true, type: Date})
    public dateOfIssue: Date;

    @prop({required:true, type: String})
    public userAgent: string;

    @prop({required:true, type: String})
    public ip: string;

    constructor(token:string, userAgent:string, ip:string) { this.token = token; this.userAgent = userAgent; this.ip = ip; this.dateOfIssue = new Date(); }
}

@modelOptions ( { schemaOptions: { autoCreate: false , collection: "accounts" }, existingConnection:dbMongoose } )
export class AccountClass
{
    @prop({required:true})
    public username!:string;

    @prop({required:true})
    public passwordHash!:string;

    @prop({required:true, type: Token })
    public sessions!: Token[];
    
    /**
     * Register and login a new account. Return a token in string if sucessful, and throw error if failed.
     * @param usernameRaw 
     * @param passwordRaw 
     * @returns 
     */
    public static async register(usernameRaw:string, passwordRaw:string, userAgent:string, ip:string)
    {
        if (await isUsernamePass(usernameRaw) == false) throw new Error("Username failed requirement, or username is taken.");
        else if (!isPasswordPass(passwordRaw)) throw new Error("Password failed requirements.");
        let hashedPassword = await bcrypt.hash(passwordRaw, saltRounds);
        await AccountModel.create(
        {
            username: usernameRaw,
            passwordHash: hashedPassword,
            sessions: []
        });
        
        let token = await AccountClass.login(usernameRaw, passwordRaw, userAgent, ip);
        return token;
    }   

    /**
     * Login to an account. Return a token if successful, and undefined if failed.
     * @param usernameRaw 
     * @param passwordRaw 
     * @returns 
     */
    public static async login(usernameRaw:string, passwordRaw:string, userAgent:string, ip:string)
    {
        try
        {
            let accDoc = await AccountModel.findOne( { username: usernameRaw });
            
            if (accDoc == undefined) return undefined;
            if (await bcrypt.compare(passwordRaw, accDoc.passwordHash) == false) return undefined;

            else 
            {
                let token = crypto.randomUUID();
                accDoc.sessions.push(new Token(token, userAgent, ip));
                await accDoc.save();
                return token;
            }
        }
        catch(e) { console.log(e); return undefined; }
    }

    public static async usernameExists(usernameRaw:string)
    {
        return (await AccountModel.find({username: usernameRaw})).length > 0;
    }

    public static async isSessionMatch(token:string, usernameRaw:string)
    {
        if (!token || !usernameRaw) return false;
        let accDoc = await AccountModel.findOne({username: usernameRaw});
        if (accDoc == undefined) return false;
        await this.clearExpiredSessions(usernameRaw);
        let sessionDoc = accDoc.sessions.find(session => session.token == token);
        if (sessionDoc == undefined) return false;
        return true;
    }

    public static async clearExpiredSessions(usernameRaw:string)
    {
        let accDoc = await AccountModel.findOne({username: usernameRaw});
        if (accDoc == undefined) throw new Error(`The given account ${usernameRaw} does not exist.`);
        let oldSessionCount = accDoc.sessions.length;
        accDoc.sessions = accDoc.sessions.filter(session => 
        {
            return (new Date().getTime() - session.dateOfIssue.getTime()) <= sessionsExpireMs 
        });
        if (oldSessionCount != accDoc.sessions.length) await accDoc.save();
    }
}
export const AccountModel = getModelForClass(AccountClass);

export async function isUsernamePass(usernameRaw) 
{
    if (!usernameRaw) return false;
    if (typeof (usernameRaw) != "string") return false;
    if (usernameRaw.length <= 3 || usernameRaw.length >= 20) return false;
    if (/^[a-zA-Z0-9_]*$/g.test(usernameRaw) == false) return false;
    if (await AccountClass.usernameExists(usernameRaw)) return false;
    return true;
}

export function isPasswordPass (passwordRaw)
{
    if (!passwordRaw) return false;
    if (typeof (passwordRaw) != "string") return false;
    if (passwordRaw.length <= 3 || passwordRaw.length >= 40) return false;
    return true;
}

// return a token in string if sucessful, and return error if failed.
// export async function createAccount (usernameRaw, pwRaw)
// {   
//     if (await isUsernamePass(usernameRaw) == false) throw new Error("Username doesn't pass");
//     else if (!isPasswordPass(pwRaw)) throw new Error("Password doesn't pass");
//     var hashedPassword = await bcrypt.hash(pwRaw, saltRounds);
//     // await db.dbInstance.collection("accounts").insertOne(
//     // {
//     //     username: usernameRaw,
//     //     passwordHash: hashedPassword,
//     //     sessions: []
//     // });
//     var l = await login(usernameRaw, pwRaw);
//     console.log(l);
//     return l;
// }

// export async function isSessionMatch (tokenString, usernameRaw): Promise<boolean>
// {
//     if (!tokenString) return false;
//     var accDoc = (await getAccDocByUsername(usernameRaw));
//     if (accDoc == undefined) { return false; }
//     return accDoc.sessions.includes(tokenString) as boolean;
// // }

// // return a token in string if passed, return undefined if failed.
// export async function login (usernameRaw, pwRaw)
// {
//     try
//     {
//         var accDoc = await getAccDocByUsername(usernameRaw);
//         if (accDoc == undefined) return undefined;
//         if (await bcrypt.compare(pwRaw, accDoc.passwordHash) == false) return undefined;
//         else 
//         {
//             var token = crypto.randomUUID();
//             // await db.dbInstance.collection("accounts").updateOne(
//             // {
//             //     _id: new ObjectId(accDoc._id)
//             // }, 
//             // {
//             //     "$set":
//             //     {
//             //         sessions: [...accDoc.sessions ?? [], token]
//             //     }
//             // })
//             return token;
//         }
//     }
//     catch(e) { console.log(e); return undefined; }
// // }

// async function getAccDocByUsername (username)
// {
//     return {} as any;

//     // var docs = await db.dbInstance.collection("accounts").find({username: username}).toArray();
//     // if (docs.length == 0) return undefined;
//     // else return docs[0];
// }