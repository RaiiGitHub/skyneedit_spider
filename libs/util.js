"use strict";


const _ = require("underscore");
const fs = require("fs-extra");
const crypto = require("crypto");
const path = require("path");

class Util {

    static * eval(nightmare, scode) {
        var ret = yield nightmare.evaluate(function (scode) {
            try {
                //不是个好办法...
                var ret = eval(scode);
                return ret;
            } catch (e) {
                return undefined;
            }
        }, scode);

        return ret;
    }

    static * screenShot(nightmare, file, rect) {
        if (!nightmare) return;
        let Log = require("./log");
        try {
            if (!rect) {
                yield nightmare.screenshot(`${file}.jpg`);
            }
            else {
                yield nightmare.screenshot(`${file}.jpg`, rect);
            }
            // Log.debug("image:", new Buffer(fs.readFileSync(`${file}.jpg`).toString()));
            Log.file(path.parse(file).name, fs.readFileSync(`${file}.jpg`), "jpg");
        } catch (e) {
            Log.debug("screenShotExp:", e);
        }
    }

    static *getElementRect(nightmare, selector) {
        return yield nightmare.evaluate(function (selector) {
            let rect = { x: 0, y: 0, width: 0, height: 0 };
            try {
                let item = document.querySelector(selector);
                if (item) {
                    let boundRect = item.getBoundingClientRect();
                    rect = { x: parseInt(boundRect.left), y: parseInt(boundRect.top), width: parseInt(boundRect.width), height: parseInt(boundRect.height) };
                }
            } catch (e) {

            }
            return rect;
        }, selector);
    }
    static decodeWbHtml(html) {
        if (html) {
            const WBFontHack = require("../logic/fonthack/wbfonthack");
            let obj = new WBFontHack();
            html = obj.queryHtml(html);
        }
        return html;
    }
    /**
     * 传入字体的base64值，不要前面的修饰，返回文字的索引map
     * @param {*font base64 string} font 
     */
    static queryWbFontMap(font) {
        let ret = {};
        if (font) {
            const WoffFont = require("../logic/fonthack/wb/wofffont");
            let obj = new WoffFont(font);
            ret = obj.queryAll();
        }
        return ret;
    }
    /**
     * 将wb的string输入，输出翻译后的字符串
     * @param {*object} font  上面函数返回值
     * @param {*string} text 
     */
    static queryWbText(font, text) {
        if (font && text) {
            let ret = text;
            const Entities = require('html-entities').XmlEntities;
            const entities = new Entities();
            for (let i = 0; i < ret.length; i++) {
                let f = ret[i];
                let ft = entities.encodeNonASCII(f).replace("&#", "").replace(";", "");
                let r = font[ft];
                // console.log("it:" + f + " fit:" + ft + " r:" + r);
                r != undefined ? ret = ret.replace(f, r) : r;
            }

            return ret;
        }
        return text;
    }

    static filterSensitive(source, pattern, replaceChar) {
        var match = new RegExp(`${pattern}[:=]+[^ &:,;]+`, "gim");
        return source.replace(match, `${pattern}:${replaceChar}`);
    }

    static requireReload(module) {
        delete require.cache[require.resolve(module)];
        return require(module);
    }

    static newServer(serverName) {
        var serverClass = require(`./${serverName}`);
        var server = new serverClass();
        //Log.debug(JSON.stringify(serverClass), server);
        return server;
    }

    static newService(serviceName) {
        var serviceClass = require(`./${serviceName}`);
        var service = new serviceClass();

        return service;
    }

    static extend(destination, source) {
        //会把 source 里的 undefined 和 null 过滤掉
        source = _.omit(source, (value, key) => {
            return _.isUndefined(value) || _.isNull(value) || _.isNaN(value);
        });

        return _.extend(destination, source);
    }


    static shellExec(cmd) {
        var shell = require('shelljs');
        var config = require('shelljs').config;
        config.silent = true;
        var sr = shell.exec(cmd);
    }

    static isNodeProcess(pid) {
        var shell = require('shelljs');
        var config = require('shelljs').config;
        config.silent = true;
        var sr = shell.exec(`ps ${pid} | grep node`);
        if (!sr.stdout) {
            return false;
        } else {
            //最老的也是 node 进程. 可以退出了
            return true;
        }
    }

    static writePidFile(pidPath) {
        require("fs").writeFileSync(pidPath, process.pid);
    }

    static md5(text) {
        var hasher = crypto.createHash("md5");
        hasher.update(text);
        return hasher.digest('hex');
    }

    static glob(dir) {
        var f = require("fs");
        var files = f.readdirSync(dir) || [];
        files.sort(function (a, b) {
            var afs = f.statSync(dir + "/" + a);
            var bfs = f.statSync(dir + "/" + b);

            return afs.mtime.getTime() - bfs.mtime.getTime();
        });

        return files;
    }

    static genFullUrl(base, url) {
        if (!url) {
            return "";
        } else {
            //TODO 需要细化 处理  / 问题
            return base + url;
        }
    }

    static formatNowHourMinute() {
        var date = new Date();
        var minutes = date.getMinutes();
        minutes = minutes > 9 ? minutes : '0' + minutes;
        return date.getHours() + ':' + minutes;
    }


    static formatNowFull() {
        var date = new Date();
        return date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate() + ' ' + date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();
    }

    static formatDate(time, sep, withYear) {
        sep = sep || '-';
        withYear = (typeof withYear == "undefined") ? true : false;
        time || (time = Util.now());
        var date = new Date(time * 1000);
        return (withYear ? date.getFullYear() + sep : "") + (date.getMonth() + 1) + sep + date.getDate();
    }

    static verboseSize(size) {
        var s = size;
        var n = ["B", "K", "M", "G", "T", "P"];
        for (var i = 0; i < n.length; i++) {
            var ss = s;
            s = s / 1024;
            if (s < 1) {
                return parseInt(ss * 10) / 10 + n[i];
            }
        }
        return parseInt(ss * 10) / 10 + n[n.length - 1];
    }

    static now() {
        //一个像php的now的返回 秒为单位
        return parseInt((new Date()).getTime() / 1000);
    }

    static isFail(ret) {
        if (null === ret || false === ret) {
            return true;
        }
        if (_.isObject(ret) && ret.err && ret.err != "ok") {
            return true;
        }
        return false;
    }

    static parseException(e, errType) {
        var ret = {
            err: "exp",
            msg: e.message
        };
        errType ? ret.err = errType : ret;
        return Util.parseNightmareException(ret);
    }

    static parseNightmareException(err) {
        let sErr = JSON.stringify(err);
        let ret = {}
        if ((sErr.indexOf("ERR_INTERNET_DISCONNECTED") != -1) ||
            (sErr.indexOf("ERR_PROXY_CONNECTION_FAILED") != -1) ||
            (sErr.indexOf("ECONNREFUSED") != -1) ||
            (sErr.indexOf("ETIMEDOUT") != -1)) {
            ret.err = "proxyUnreachable";
            ret.msg = err.msg;
        }
        else if (sErr.indexOf("noSearchPermissions") != -1) {
            ret.err = "noSearchPermissions";
        }
        else if (sErr.indexOf("outOfPVRange") != -1) {
            ret.err = "outOfPVRange";
            ret.msg = "out of pv range";
        }
        else {
            ret = err;
        }
        return ret;
    }

    static procesNightmareUnknown(nightmare, ret) {
        //对于unkonow的页面, 可以补上 title 截屏等

        return ret;
    }

    //FIXME: HACK
    //以下两个函数是一个暂时的办法 . 还没有找到更好的方式.
    //需要优化.
    /*
    static addAutoIncIdToSchema(schema) {
        //save
        schema.pre('save', function(next) {
            var that = this;
            Log.debug("schema save " + this.toString());

            if (this.isNew) {
                Log.debug("schema save _nextId isNew");
                GlobalIds._nextId("Tasks", 1, function(id) {
                    Log.debug("schema save _nextId callback");
                    if (null === id) {
                        Log.error();
                        //throw ??
                    } else {
                        that.id = id;
                        next();
                    }
                });
            } else {
                next();
            }
        });

        //findOneAndUpdate
        schema.pre('updateOne', function(next) {
            Log.debug("schema updateOne " + this.toString());
            var update = this.getUpdate();
            var query = this.getQuery();
            Log.debug(JSON.stringify(query));
            Log.debug(JSON.stringify(update));


            var that = this;
            if (this.isNew) {
                Log.debug("schema findOneAndUpdate _nextId isNew");
                GlobalIds._nextId("Tasks", 1, function(id) {
                    Log.debug("schema save _nextId callback");
                    if (null === id) {
                        Log.error();
                        //throw ??
                    } else {
                        that.id = id;
                        next();
                    }
                });
            } else {
                next();
            }
        });

    }

    /*
    static addAutoIncIdToModel(model, modelName) {
            model.__insertMany__ = model.insertMany;
            model.insertMany = function(arr, options, callback) {
                    //需要得到递增的id. 这里后面的insert可能失败. 这个会导致globalId被浪费. 只要不重复就ok了. 允许浪费
                    var step = arr.length;
                    Log.debug("insertMany " + step);
                    return GlobalIds._nextId(modelName, step, function(id) {
                        if (null === id) {
                            Log.error("get GlobalIds fail for " + modelName);
                            //FIX ME 一定要 throw ??
                        } else {
                            for (var i = 0; i < step; i++) {
                                arr[i]["id"] = id + i;
                            }

                            return model.__insertMany__(arr, options, callback);
                        }
                    });

                } //insertMany
        } //addAutoIncIdToModel
	*/



    /*
    	保存的目录结构.
    	 root - task1
              - task2 -  job
                      -
                      -  company  - error
                                  -  0 (按某个id  做 % 1024 的hash)
                                   - 1
                                   -  ..
                                   - 1023  - 文件1
                                           - 文件N
     */
    static getPageSavePath(root, taskName, taskType, id, url) {
        var dir = root + "/" + taskName + "/" + taskType + "/" + (id % 1024) + "/";
        //判断目录是否存在, 不存在 创建之.
        fs.ensureDirSync(dir);

        return dir + "/" + url;
    }

    static getPageErrorPath(root, taskName, taskType, id, url) {
        return root + "/" + taskName + "/" + taskType + "/error";
    }

    /**
     * 模拟鼠标事件和键盘事件
     * @param {*事件发起者} el 
     * @param {*事件类型} evtType 
     * @param {*值} keyCode 
     */
    static fireKeyEvent(el, evtType, keyCode) {
        var doc = el.ownerDocument,
            win = doc.defaultView || doc.parentWindow,
            evtObj;

        Log.debug('enter KeyEvent');
        if (doc.createEvent) {
            if (win.KeyEvent) {
                evtObj = doc.createEvent('KeyEvents');
                evtObj.initKeyEvent(evtType, true, true, win, false, false, false, false, keyCode, 0);
            }
            else {
                evtObj = doc.createEvent('UIEvents');
                Object.defineProperty(evtObj, 'keyCode', {
                    get: function () { return this.keyCodeVal; }
                });
                Object.defineProperty(evtObj, 'which', {
                    get: function () { return this.keyCodeVal; }
                });
                evtObj.initUIEvent(evtType, true, true, win, 1);
                evtObj.keyCodeVal = keyCode;
                if (evtObj.keyCode !== keyCode) {
                    Log.debug("keyCode " + evtObj.keyCode + " 和 (" + evtObj.which + ") 不匹配");
                }
            }
            el.dispatchEvent(evtObj);
        }
        else if (doc.createEventObject) {
            evtObj = doc.createEventObject();
            evtObj.keyCode = keyCode;
            el.fireEvent('on' + evtType, evtObj);
        }
    }

    static base64_encode(text) {
        return new Buffer(text).toString('base64');
    }

    static base64_decode(text) {
        var bitmap = new Buffer(text, 'base64');
        return bitmap.toString();
    }

    /**
    * 计算base和diff所表示的时间按照type作差值
    * @param {*} base 基准时间，为空时默认当前时间
    * @param {*} diff 与base相比较的时间
    * @param {*} format 标准的时间格式化方式
    * @param {*} type days/months/years/hours/minutes/seconds
    * [注]diff和format不能为空
    */
    static timeInterval(base, diff, format, type) {
        if (!format || !diff) return "";
        let moment = require("moment");
        let bm, dm;
        !base ? bm = new moment() : bm = new moment(base, format)
        dm = new moment(diff, format);
        let ret = 0;
        try {
            type ? ret = bm.diff(dm, type) : ret = bm.diff(dm, "days");
        } catch (e) {
            ret = 0;
        }
        if (typeof ret == "number") {
            return ret;
        }
        return 0;
    }
    /**
     * 计算base代表的时间的时间戳,base和format存在不合法数据则为当前时间的时间戳
     * 精度为ms
     * @param {*} base 
     * @param {*} format 
     */
    static timeStamp(base, format) {
        let moment = require("moment");
        let ret;
        if (base && format) {
            ret = new moment(base, format).format("x");
        }
        else {
            ret = new moment().format("x");
        }
        return parseInt(ret / 1000);
    }

    static *saveHtml(nm, file) {
        if (!nm || !file) return;
        let Log = require("./log");
        try {
            let doc = yield nm.evaluate(function () {
                return document.getElementsByTagName('html')[0].outerHTML;
            });
            fs.writeFileSync(`${file}.html`, doc);
            Log.file(path.parse(file).name, new Buffer(doc), "html");
        } catch (e) {
            Log.debug("saveHtmlExp:", e);
        }
    }

    static getStringOccTimes(key, src) {
        var count;
        var reg = "/" + key + "/g";

        reg = eval(reg);
        if (src.match(reg) == null) {
            count = 0;
        } else {
            count = src.match(reg).length;
        }

        return count;
    }

}


module.exports = Util;
