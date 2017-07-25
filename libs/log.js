"use strict";

const _ = require("underscore");
const process = require("process");
const nutil = require("util"); //node util

const fs = require("fs-extra");
const ip = require('ip');
const Util = require("./util");
//const CSLog = require("./cslog");

Date.prototype.format = function(fmt) { 
     var o = { 
        "M+" : this.getMonth()+1,                 //月份 
        "d+" : this.getDate(),                    //日 
        "h+" : this.getHours(),                   //小时 
        "m+" : this.getMinutes(),                 //分 
        "s+" : this.getSeconds(),                 //秒 
        "q+" : Math.floor((this.getMonth()+3)/3), //季度 
        "S"  : this.getMilliseconds()             //毫秒 
    }; 
    if(/(y+)/.test(fmt)) {
            fmt=fmt.replace(RegExp.$1, (this.getFullYear()+"").substr(4 - RegExp.$1.length)); 
    }
     for(var k in o) {
        if(new RegExp("("+ k +")").test(fmt)){
             fmt = fmt.replace(RegExp.$1, (RegExp.$1.length==1) ? (o[k]) : (("00"+ o[k]).substr((""+ o[k]).length)));
         }
     }
    return fmt; 
}

class Log {
    //access 日志
    static _logA(type, msg) {
        var now = (new Date()).format("yyyy-MM-dd hh:mm:ss.S");
        var other = '';
        for(var a = 2; a < arguments.length;a++ ){
            other += ', ';
            other += arguments[a];
        }
        var txt = `[${now}]${type}: ${msg}${other} \r\n`;
        //发到日志系统 send(logid, level, tag, content, type) {
        //Log.cslog.send(Log.currentLogId, type, "", msg);

        if (Log.basePath) {
            //log按照日期存储
            let path = this.ensureFileSync("access");
            fs.outputFile(path, txt, {
                flag: "a+"
            }, (err) => { });
        } else {
            //如果没有指定文件, 直接打到stdout里
            console.log(txt);
        }
    }

    //access 日志
    static _logR(type, msg) {
        var now = (new Date()).format("yyyy-MM-dd hh:mm:ss.S");
        var other = '';
        for(var a = 2; a < arguments.length;a++ ){
            other += ' ';
            other += arguments[a];
        }
        var txt = `[${now}]${type}: ${msg}${other} \r\n`;
        if (Log.basePath) {
            //log按照日期存储
            let path = this.ensureFileSync("runtime");
            fs.outputFile(path, txt, {
                flag: "a+"
            }, (err) => { });
            //temporary output to console.
            console.log(txt);
        } else {
            //如果没有指定文件, 直接打到stdout里
            console.log(txt);
        }
    }

    //error 日志
    static _logE(type, msg) {
        var now = (new Date()).format("yyyy-MM-dd hh:mm:ss.S");
        var other = '';
        for(var a = 2; a < arguments.length;a++ ){
            other += ', ';
            other += arguments[a];
        }
        var txt = `[${now}]${type}: ${msg}${other} \r\n`;
        //发到日志系统 send(logid, level, tag, content, type) {
        //Log.cslog.send(Log.currentLogId, type, "", msg);

        if (Log.basePath) {
            let path = this.ensureFileSync("error");
            fs.outputFile(path, txt, {
                flag: "a+"
            }, (err) => { });
        } else {
            //如果没有指定文件, 直接打到stdout里
            console.log(txt);
        }
    }

    static ensureFileSync(fileName) {
        var fdate = Util.formatDate();
        var path = Log.basePath + `/${fdate}/${fileName}.log`;
        fs.ensureDirSync(Log.basePath + `/${fdate}`);
        fs.ensureFileSync(path);
        return path;
    }

    static newLogId(id) {
        if (id) {
            Log.currentLogId = id;
        } else {
            //生成的方式是.  本机 ip proessid timestamp 的MD5
            Log.currentLogId = Util.md5(`${ip.address()}:${process.pid}:${new Date().getTime()}`);
        }
    }

    static push(info = "") {
        Log.pushInfo ? Log.pushInfo = Log.pushInfo + " " + info : Log.pushInfo = info;
    }

    static _joinArguments(args) {
        var str = `[${Util.formatNowFull()}] pid:${process.pid}`;
        if (Log.currentLogId) {
            str += ` logid:${Log.currentLogId}`;
        }
        if (Log.pushInfo) {
            str += ` ${Log.pushInfo}`;
        }

        var args = Array.prototype.slice.call(args);

        args = _.map(args, (value) => {
            if (_.isObject(value)) {
                if (_.isError(value)) {
                    //var str = `Exp:${value.message} `;
                    var str = value.stack;
                    return str;
                } else {
                    return JSON.stringify(nutil.inspect(value));
                }
            } else {
                return value;
            }
        });

        str += " " + args.join(" ");

        return str;
    }

    static debug(msg) {
        Log._logA("DEBUG", Log._joinArguments(arguments));
    }

    static release(msg) {
        Log._logR("RUNTIME", Log._joinArguments(arguments));
    }

    static trace(msg) {
        Log._logA("TRACE", Log._joinArguments(arguments));
    }

    static warn(msg) {
        Log._logE("WARN", Log._joinArguments(arguments));
    }

    static error(msg) {
        Log._logE("ERROR", Log._joinArguments(arguments));
    }

    static notice(msg) {
        Log._logA("NOTICE", Log._joinArguments(arguments));
    }

    static file(msg, file, fileType) {
        //Log.cslog.sendFileAndLog(Log.currentLogId, 'trace', msg, file, fileType);
    }

    static init(dir, level, system, module) {
        //TODO 实现 log level
        var fdate = Util.formatDate();
        Log.basePath = dir;
        Log.pushInfo = "";
        fs.ensureDirSync(Log.basePath);
        //Log.cslog = new CSLog(system, module);
    }
};

module.exports = Log;
