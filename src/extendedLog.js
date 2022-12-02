var colors = require('@colors/colors');

exports.log = function (arg)
{
    console.log(arg);
}

exports.logRed = function (arg)
{
    console.log(arg.toString().red);
}

exports.logGreen = function (arg)
{
    console.log(arg.toString().green);
}