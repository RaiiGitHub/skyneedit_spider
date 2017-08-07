"use strict";
const mysql = require('mysql');
const printf = require('printf');
const lr = require('line-reader');
const async = require('async');
const dbop = require('../libs/dboperator');
const log = require('../libs/log');

Date.prototype.format = function (fmt) {
    var o = {
        "M+": this.getMonth() + 1,                 //月份 
        "d+": this.getDate(),                    //日 
        "h+": this.getHours(),                   //小时 
        "m+": this.getMinutes(),                 //分 
        "s+": this.getSeconds(),                 //秒 
        "q+": Math.floor((this.getMonth() + 3) / 3), //季度 
        "S": this.getMilliseconds()             //毫秒 
    };
    if (/(y+)/.test(fmt)) {
        fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    }
    for (var k in o) {
        if (new RegExp("(" + k + ")").test(fmt)) {
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
        }
    }
    return fmt;
}

class DbOperatorTYC extends dbop {
    constructor() {
        super('192.168.6.184', 'root', 'admin111', 'tianyancha');
        //super('localhost', 'root', 'admin111', 'tianyancha');
        //super('localhost', 'root', 'mysql', 'tianyancha');
        //insert-cache-ops
        this.queues_ = { insert_com_breif: [], insert_com_page: [], update_search: [] };
        //this.id_history_ = { id_com_breif: [], id_com_page: [] };
        DbOperatorTYC.cache_size_ = { brief: 30, page: 10, update: 40 };
        DbOperatorTYC.cache_time_out_ = 120;
    }
    ensureDbExist(callback) {
        //warning! if call this, it should be called before connecting.
        var con = mysql.createConnection({
            host: this.host_,
            user: this.user_,
            password: this.psw_
        });
        var db_name = 'CREATE DATABASE IF NOT EXISTS `tianyancha`;'
        var self = this;
        console.log(db_name);
        con.query(db_name, function (error, results, fields) {
            console.log('no return...');
            if (error) {
                log._logE('Mysql::ensureDbExist', 'create tianyancha failed.', db_name);
                callback(false);
            } else {
                log._logR('Mysql::ensureDbExist', 'database tianyancha created.');
                callback(true);
            }
            con.end();
        });
    }
    ensureTablesExist(callback) {
        var enterprise_base = "CREATE TABLE IF NOT EXISTS `enterprise_base`(\
                        `id` bigint primary key COMMENT '公司（企业）代码，作为主键',\
                        `keyName` VARCHAR(255) NULL COMMENT '源于搜索关键字', \
                        `fullName` VARCHAR(255) NULL COMMENT '全称', \
                        `url` VARCHAR(255) NULL COMMENT '详情页面url',\
                        `urlValid` VARCHAR(1) NULL COMMENT '验证页面url是否有效',\
                        `briefDesc` VARCHAR(8192) COMMENT 'Json格式的简明描述',\
                        `recordTime` timestamp NULL DEFAULT '0000-00-00 00:00:00' COMMENT '记录的时间'); ";

        var enterprise_detail = "CREATE TABLE IF NOT EXISTS `enterprise_detail`(\
                        `id` bigint primary key COMMENT '公司（企业）代码，作为主键',\
                        `detailDesc` VARCHAR(8192) COMMENT 'Json格式的简明描述',\
                        `html` MEDIUMTEXT NULL COMMENT '详情页面内容', \
                        `recordTime` timestamp NULL DEFAULT '0000-00-00 00:00:00' COMMENT '记录的时间',\
                        foreign key(id) references enterprise_base(id) ON DELETE CASCADE ON UPDATE RESTRICT);";

        var search_keys = "CREATE TABLE IF NOT EXISTS `search_keys`(\
                        `id` int auto_increment primary key COMMENT '自增长的键值',\
                        `searchKey` VARCHAR(45) NULL COMMENT '搜索关键字',\
                        `memo` VARCHAR(45) NULL COMMENT '备注',\
                        `status` VARCHAR(45) NULL COMMENT '运行状态-running,not start,finished,failed',\
                        `description` VARCHAR(8192) NULL COMMENT '附加描述，包含出错信息',\
                        `pageCount` int NULL COMMENT '页面数',\
                        `searchStartTime` timestamp NULL DEFAULT '0000-00-00 00:00:00' COMMENT '搜索开始时间',\
                        `searchEndTime` timestamp NULL DEFAULT '0000-00-00 00:00:00' COMMENT '搜索结束时间');";
        this.queries([enterprise_base, enterprise_detail, search_keys], [], function (err, result) {
            if (!!err) {
                console.log(err);
            } else {
                console.log('Mysql::ensureTablesExist', 'Completed jobs...');
            }
        });
    }

    insertSeachKeys(filepath, matchobj, callback) {
        //insert by file,will check the key. make sure it is distinct
        //{match:'/(\d+)---(\S*)/',index:2}
        var self = this;
        var skeys = [];
        var tasks = [];
        var insert_func = function (cb) {
            if (0 == skeys.length) {
                callback(true);
                cb(null);
                return;
            } else {
                var km = skeys.splice(0, 1)[0];
                self.verifySearchKeyExists(km.key, function (ok) {
                    if (!ok) {
                        var q = printf("insert into search_keys(searchKey,memo,status) values('%s',%s,'%s')",
                            km.key, km.memo, 'not start');
                        self.query(q, null,function (error, results, fields) {
                            if (error) {
                                log._logE('Mysql::insertSeachKeys', 'exist,or unknown...', q);
                                callback(false);
                            } else {
                                console.log(q);
                            }
                        });
                        cb(null);
                    } else {
                        console.log(km.key, 'already exists...');
                        cb(null);
                    }
                });
            }
        }
        var line_index = 0;
        lr.eachLine(filepath, function (line, last) {
            line_index++;
            if (null != matchobj.from && matchobj.from < line_index) {
                var key = line.match(matchobj.match)[matchobj.index.key];
                var memo = line.match(matchobj.match)[matchobj.index.memo];
                skeys.push({ key: key, memo: memo });
                tasks.push(function (cb) {
                    insert_func(cb);
                })
            }
            if (last) {
                async.waterfall(tasks, function (err, result) {

                });
            }
        });
    }

    verifySearchKeyExists(key, callback) {
        var self = this;
        var q = printf('select 1 from search_keys where searchKey = \'%s\' limit 1;', key);
        self.query(q,null,function (error, results, fields) {
            if (!error) {
                callback(results.length == 1);
            } else {
                log._logE('Mysql::verifySearchKeyExists', q, error.stack);
                callback(false);
            }
        });
    }

    updateSearchKeyStatus(keyid, status, callback, desc, pagecount) {
        var self = this;
        var now = (new Date()).format("yyyy-MM-dd hh:mm:ss");
        //error,finish,running
        var st = status == 'running' ? (",searchStartTime='" + now + "'") : '';
        var se = status != 'running' ? (",searchEndTime='" + now + "'") : '';
        var de = desc != null ? ",description='" + desc.replace(/'/g, '"') + "'" : '';
        var pc = pagecount != null ? ",pageCount=" + pagecount : '';
        var q = printf("update search_keys set status = '%s'%s%s%s%s where id=%d;", status, st, se, de, pc, keyid);
        console.log(q);
        self.queues_.update_search.push(q);
        self.updateSearchKeyStatusBatch();
        if (callback)
            callback(true);
    }

    updateSearchKeyStatusBatch(force) {
        var self = this;
        var batch_func = function (limit) {
            if (limit <= 0)
                return;
            var sqls = [];
            for (var i = 0; i < limit; i++) {
                sqls.push(self.queues_.update_search.splice(0, 1)[0]);
            }
            self.queries(sqls, [], function (err, result) {
                if (!!err) {
                    log._logE('Mysql::updateSearchKeyStatusBatch::Error', err.stack, JSON.stringify(sqls));
                }
                log._logR('Mysql::updateSearchKeyStatusBatch', 'Completed with', limit, 'jobs...');
            });
        }
        if (true == force) {
            batch_func(self.queues_.update_search.length);//batch all.
        }
        else if (DbOperatorTYC.cache_size_.update <= self.queues_.update_search.length) {
            batch_func(DbOperatorTYC.cache_size_.update);
        } else {
            //setup a timer
            if (0 < self.queues_.update_search.length) {
                setTimeout(function () {
                    batch_func(self.queues_.update_search.length);
                }, DbOperatorTYC.cache_time_out_ * 1000);
            }
        }
    }

    getSearchKeys(from, count, callback) {
        var self = this;
        var limit = count ? ('limit ' + count) : '';
        var q = printf("SELECT id,searchKey FROM search_keys where id >= %d %s;", from, limit);
        self.query(q, null,function (error, results, fields) {
            if (!error && results.length > 0) {
                callback(results);
            } else {
                console.log('Mysql::getSearchKeys', q, error);
                callback(null);
            }
        });
    }

    resetAbnormalSearchKey(callback){
        var self = this;
        var q = printf("UPDATE search_keys SET status = 'running',description=NULL WHERE pageCount = 0;");
        self.query(q, null,function (error, results, fields) {
            if (!error) {
                callback(true);
            } else {
                console.log('Mysql::resetAbnormalSearchKey', q, error);
                callback(false);
            }
        });
    }
    getUnfinishedSearchKeys(callback){
        var self = this;
        var q = printf("SELECT id,searchKey FROM search_keys WHERE status != 'finished' and status is not null;");
        self.query(q, null,function (error, results, fields) {
            if (!error && results.length > 0) {
                callback(results);
            } else {
                console.log('Mysql::getUnfinishedSearchKeys', q, error);
                callback(null);
            }
        });
    }

    getSearchCount(callback) {
        var self = this;
        var q = printf("SELECT count(*) AS num FROM search_keys;");
        self.query(q, null,function (error, results, fields) {
            if (!error) {
                callback(results[0].num);
            } else {
                log._logE('Mysql::getSearchCount', q, error.stack);
                callback(null);
            }
        });
    }

    getCompanyMaxID(callback) {
        var self = this;
        var q = printf("SELECT max(id) as id FROM enterprise_base;");
        self.query(q, function (error, results, fields) {
            if (!error) {
                callback(results[0].id);
            } else {
                log._logE('Mysql::getCompanyMaxID', q, error.stack);
                callback(null);
            }
        });
    }

    getNoDetailPageUrls(callback) {
        var self = this;
        var limit = null != arguments[1] ? printf('limit %d;', arguments[1]) : '';
        var condition = null != arguments[2] ? (arguments[2] + ' and') : '';
        var q = printf("SELECT url,id FROM enterprise_base WHERE %s (urlValid is NULL or urlValid = 1) And id NOT IN(SELECT id FROM enterprise_detail) %s", condition, limit);
        log._logR('Mysql::getNoDetailPageUrls', q);
        self.query(q, null,function (error, results, fields) {
            if (!error) {
                callback(results);
            } else {
                log._logE('Mysql::getNoDetailPageUrls', q, error.stack);
                callback(null);
            }
        });
    }

    verifyCompanyExists(id, callback) {
        var self = this;
        var q = printf('select 1 from enterprise_base where id = %d limit 1;', id);
        self.query(q, null,function (error, results, fields) {
            if (!error) {
                callback(results.length == 1);
            } else {
                log._logE('Mysql::verifyCompanyExists', q, error.stack);
                callback(false);
            }
        });
    }

    verifyCompanyPageExists(id, callback) {
        var self = this;
        var q = printf('select 1 from enterprise_base where id = %d limit 1;', id);
        self.query(q, null,function (error, results, fields) {
            if (!error) {
                callback(results.length == 1);
            } else {
                log._logE('Mysql::verifyCompanyPageExists', q, error.stack);
                callback(false);
            }
        });
    }

    updateCompanyUrlVerified(id, valid, callback) {
        var self = this;
        //valid can be null.
        var q = printf("UPDATE enterprise_base SET urlValid = %s WHERE id = %d;", !!valid ? 'NULL' : valid, id);
        self.query(q, null,function (error, results, fields) {
            if (!error) {
                if (callback)
                    callback(true);
            } else {
                log._logE('Mysql::updateCompanyUrlVerified', q, error.stack);
                if (callback)
                    callback(false);
            }
        });
    }

    insertCompany(desc) {
        var self = this;
        var q = printf("(%d,'%s','%s','%s','%s',NOW())",
            desc.brief.company_id, desc.key.replace(/'/g,"''"), desc.brief.company_name.replace(/'/g,"''"), desc.brief.company_detail_url, JSON.stringify(desc.brief).replace(/'/g,"''"));
        self.queues_.insert_com_breif.push(q);
        //self.id_history_.id_com_breif.push(desc.brief.company_id);
        console.log('Mysql::insertCompany', 'cache->', self.queues_.insert_com_breif.length);
        self.insertCompanyBatch();//maybe run the batch.
    }

    insertCompanyBatch(force, callback) {
        var self = this;
        var batch_func = function (limit) {
            if (limit <= 0) {
                if (callback)
                    callback({ succeed: true });
                return;
            }
            var sql = "insert into enterprise_base(id,keyName,fullName,url,briefDesc,recordTime) values";
            var q = sql;
            for (var i = 0; i < limit; i++) {
                var item = self.queues_.insert_com_breif.splice(0, 1)[0];
                q += item;
                q += (i == limit - 1) ? ';' : ',';
            }
            log._logR('Mysql::insertCompanyBatch', q);
            self.query(q, null,function (error, results, fields) {
                log._logR('Mysql::insertCompanyBatch', 'Completed with', limit, 'jobs...');
                if (!!error) {
                    console.log(error.stack);
                    log._logR('Mysql::insertCompanyBatch::Error', error.stack);
                    if (callback)
                        callback({ succeed: false, error: error });
                } else {
                    if (callback)
                        callback({ succeed: true });
                }
            });
        }
        if (true == force) {
            batch_func(self.queues_.insert_com_breif.length);//batch all.
        }
        else if (DbOperatorTYC.cache_size_.brief <= self.queues_.insert_com_breif.length) {
            batch_func(DbOperatorTYC.cache_size_.brief);
        } else {
            //setup a timer
            if (0 < self.queues_.insert_com_breif.length) {
                setTimeout(function () {
                    batch_func(self.queues_.insert_com_breif.length);
                }, DbOperatorTYC.cache_time_out_ * 1000);
            }
        }
    }

    insertCompanyPage(desc, html, callback) {
        var self = this;
        self.queues_.insert_com_page.push({ desc: desc, html: html });
        //self.id_history_.id_com_page.push(desc.company_id);
        console.log('Mysql::insertCompanyPage', 'cache->', self.queues_.insert_com_page.length);
        self.insertCompanyPageBatch();//maybe run the batch.
    }

    insertCompanyPageBatch(force, callback) {
        var self = this;
        var batch_func = function (limit) {
            if (limit <= 0)
                return;
            var htmls = [];
            var q = "insert into enterprise_detail(id,detailDesc,html,recordTime) values";
            for (var i = 0; i < limit; i++) {
                var item = self.queues_.insert_com_page.splice(0, 1)[0];
                q += printf("(%s,'%s',?,NOW())", item.desc.company_id, JSON.stringify(item.desc));
                q += (i == limit - 1) ? ';' : ',';
                htmls.push([item.html]);
            }
            console.log(q);
            self.query(q, htmls, function (error, results, fields) {
                if (!!error) {
                    console.log(error.stack);
                }
                log._logR('Mysql::insertCompanyPageBatch', 'Completed with', limit, 'jobs...');
                if (callback) {
                    callback();
                }
            });
        }
        if (true == force) {
            batch_func(self.queues_.insert_com_page.length);
        }
        else if (DbOperatorTYC.cache_size_.page <= self.queues_.insert_com_page.length) {
            batch_func(DbOperatorTYC.cache_size_.page);
        } else {
            //setup a timer
            if (0 > self.queues_.insert_com_page.length) {
                setTimeout(function () {
                    batch_func(self.queues_.insert_com_page.length);
                }, DbOperatorTYC.cache_time_out_ * 1000);
            }
        }
    }

    // verifyCompanyInCache(id) {
    //     for (var i in this.id_history_.id_com_breif) {
    //         if (this.id_history_.id_com_breif[i] == id)
    //             return true;
    //     }
    //     return false;
    // }

    // verifyCompanyPageInCache(id) {
    //     for (var i in this.id_history_.id_com_page) {
    //         if (this.id_history_.id_com_page[i] == id)
    //             return true;
    //     }
    //     return false;

    // }


    screenPendingInsertDatas(datas, callback) {
        //building searching-conditions.
        if (0 == datas.length ) {
            if (callback)
                callback(false);//no datas.
            return;
        }
        var search_brief = 'select id from enterprise_base where ';
        var search_detail = 'select id from enterprise_detail where ';
        for (var d in datas) {
            var data = datas[d];
            search_brief += printf("id=%d", data.id);
            search_brief += (d == datas.length - 1) ? ';' : ' or ';
            search_detail += printf("id=%d", data.id);
            search_detail += (d == datas.length - 1) ? ';' : ' or ';
        }
        console.log('Mysql::screenPendingInsertDatas', 'brief:', search_brief);
        console.log('Mysql::screenPendingInsertDatas', 'detail:', search_detail);
        //log._logR('Mysql::screenPendingInsertDatas',JSON.stringify(datas));
        var self = this;
        var func_mv = function (id, brief) {
            for (var d in datas) {
                var data = datas[d];
                if (data.id == id) {
                    brief ? data.brief_exist = true : data.detail_exist = true;
                    break;
                }
            }
        }
        // //check whether exist in the id list already.
        // for (var d in datas) {
        //     var data = datas[d];
        //     if (self.verifyCompanyInCache(data.id)) {
        //         data.brief_exist = true;
        //         log._logR('Mysql::screenPendingInsertDatas','data.brief_exist','ID',data.id);
        //     } else if (self.verifyCompanyPageInCache(data.id)) {
        //         data.detail_exist = true;
        //         log._logR('Mysql::screenPendingInsertDatas','data.detail_exist','ID',data.id);
        //     }
        // }

        //check whether exist in db already.
        self.query(search_brief, null,function (error, results, fields) {
            if (!error) {
                //fill datas.
                for (var r in results) {
                    func_mv(results[r].id, true);
                }
                //next
                self.query(search_detail, null,function (error, results, fields) {
                    if (!error) {
                        for (var r in results) {
                            func_mv(results[r].id, false);
                        }
                        if (callback)
                            callback(true);
                    } else {
                        log._logR('Mysql::screenPendingInsertDatas', search_detail, error.stack);
                        if (callback)
                            callback(false);
                    }
                });
            } else {
                log._logR('Mysql::screenPendingInsertDatas', search_brief, error.stack);
                if (callback)
                    callback(false);
            }
        });
    }
};

module.exports = DbOperatorTYC;

//select TABLE_NAME from INFORMATION_SCHEMA.TABLES where TABLE_NAME='enterprise_base_index';

