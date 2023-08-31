require('colors'); // dont use import here, the init method will not be exeucted

export function log(arg:any)
{
    console.log(arg);
}

export function logRed (arg:any)
{
    console.log(arg.toString().red);
}

export function logGreen (arg:any)
{
    console.log(arg.toString().green);
}

export function logYellow (arg:any)
{
    console.log(arg.toString().yellow);
}