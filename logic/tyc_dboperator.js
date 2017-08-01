"use strict";
const mysql = require('mysql');
const printf = require('printf');
const lr = require('line-reader');
const async = require('async');
const dbop = require('../libs/dboperator');
const log = require('../libs/log');

class DbOperatorTYC extends dbop {
    constructor() {
        //super('192.168.6.184', 'root', 'admin111', 'tianyancha');
        //super('localhost', 'root', 'admin111', 'tianyancha');
        super('localhost', 'root', 'mysql', 'tianyancha');
        //insert-cache-ops
        this.queues_ = { insert_com_breif: [], insert_com_page: [], update_search: [] };
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
        });
    }
    ensureTablesExist(callback) {
        if (!this.check()) {
            callback(false);
            return;
        }
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

        var mq = require('mysql-queries');
        mq.init({
            host: this.host_,
            port: 3306,
            user: this.user_,
            password: this.psw_,
            database: this.dbname_
        })
        mq.queries([enterprise_base, enterprise_detail, search_keys], [], function (err, result) {
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
        if (!self.check()) {
            callback(false);
            return;
        }
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
                        self.connection_.query(q, function (error, results, fields) {
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
        if (!this.check()) {
            callback(false);
            return;
        }
        var q = printf('select 1 from search_keys where searchKey = \'%s\' limit 1;', key);
        this.connection_.query(q, function (error, results, fields) {
            if (!error) {
                callback(results.length == 1);
            } else {
                log._logE('Mysql::verifySearchKeyExists', q, error.stack);
                callback(false);
            }
        });
    }

    updateSearchKeyStatus(keyid, status, callback,desc,pagecount) {
        var self = this;
        if (!self.check()) {
            if (callback)
                callback(false);
            return;
        }
        //error,finish,running
        var st = status == 'running' ? ',searchStartTime=NOW()' : '';
        var se = status != 'running' ? ',searchEndTime=NOW()' : '';
        var de = desc != null?",description='"+desc+"'":'';
        var pc = pagecount != null?",pageCount="+pagecount:'';
        var q = printf("update search_keys set status = '%s'%s%s%s%s where id=%d;", status, st, se,de,pc,keyid);
        console.log(q);
        self.queues_.update_search.push(q);
        self.updateSearchKeyStatusBatch();
        if (callback)
            callback(true);
    }

    updateSearchKeyStatusBatch(force) {
        if (!this.check()) {
            return;
        }
        var self = this;
        var batch_func = function (limit) {
            if (limit <= 0)
                return;
            var mq = require('mysql-queries');
            mq.init({
                host: self.host_,
                port: 3306,
                user: self.user_,
                password: self.psw_,
                database: self.dbname_
            })
            var sqls = [];
            for (var i = 0; i < limit; i++) {
                sqls.push(self.queues_.update_search.splice(0, 1)[0]);
            }
            mq.queries(sqls, [], function (err, result) {
                if (!!err) {
                    console.log(err);
                } else {
                    log._logR('Mysql::updateSearchKeyStatusBatch', 'Completed with', limit, 'jobs...');
                }
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
        if (!this.check()) {
            callback(null);
            return;
        }
        var limit = count ? ('limit ' + count) : '';
        var q = printf("SELECT id,searchKey FROM search_keys where id >= %d %s;", from, limit);
        this.connection_.query(q, function (error, results, fields) {
            if (!error && results.length > 0) {
                callback(results);
            } else {
                console.log('Mysql::getSearchKeys', q, error);
                callback(null);
            }
        });
    }

    getSearchCount(callback) {
        if (!this.check()) {
            callback(null);
            return;
        }
        var q = printf("SELECT count(*) AS num FROM search_keys;");
        this.connection_.query(q, function (error, results, fields) {
            if (!error) {
                callback(results[0].num);
            } else {
                log._logE('Mysql::getSearchKeys', q, error.stack);
                callback(null);
            }
        });
    }

    getCompanyMaxID(callback) {
        if (!this.check()) {
            callback(null);
            return;
        }
        var q = printf("SELECT max(id) as id FROM enterprise_base;");
        this.connection_.query(q, function (error, results, fields) {
            if (!error) {
                callback(results[0].id);
            } else {
                log._logE('Mysql::getCompanyMaxID', q, error.stack);
                callback(null);
            }
        });
    }

    getNoDetailPageUrls(callback) {
        if (!this.check()) {
            callback(null);
            return;
        }
        var limit = arguments[1] ? printf('limit %d;', arguments[1]) : '';
        var condition = arguments[2] ? (arguments[2] + ' and') : '';
        var q = printf("SELECT url,id FROM enterprise_base WHERE %s (urlValid is NULL or urlValid = 1) And id NOT IN(SELECT id FROM enterprise_detail) %s", condition, limit);
        log._logR('Mysql::getNoDetailPageUrls', q);
        this.connection_.query(q, function (error, results, fields) {
            if (!error) {
                callback(results);
            } else {
                log._logE('Mysql::getNoDetailPageUrls', q, error.stack);
                callback(null);
            }
        });
    }

    verifyCompanyExists(id, callback) {
        if (!this.check()) {
            callback(false);
            return;
        }
        var q = printf('select 1 from enterprise_base where id = %d limit 1;', id);
        this.connection_.query(q, function (error, results, fields) {
            if (!error) {
                callback(results.length == 1);
            } else {
                log._logE('Mysql::verifyCompanyExists', q, error.stack);
                callback(false);
            }
        });
    }

    verifyCompanyPageExists(id, callback) {
        if (!this.check()) {
            callback(false);
            return;
        }
        var q = printf('select 1 from enterprise_base where id = %d limit 1;', id);
        this.connection_.query(q, function (error, results, fields) {
            if (!error) {
                callback(results.length == 1);
            } else {
                log._logE('Mysql::verifyCompanyPageExists', q, error.stack);
                callback(false);
            }
        });
    }

    updateCompanyUrlVerified(id, valid, callback) {
        if (!this.check()) {
            callback(false);
            return;
        }
        //valid can be null.
        var q = printf("UPDATE enterprise_base SET urlValid = %s WHERE id = %d;", !!valid ? 'NULL' : valid, id);
        this.connection_.query(q, function (error, results, fields) {
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
            desc.brief.company_id, desc.key, desc.brief.company_name, desc.brief.company_detail_url, JSON.stringify(desc.brief));
        self.queues_.insert_com_breif.push(q);
        console.log('Mysql::insertCompany', 'cache->', self.queues_.insert_com_breif.length);
        self.insertCompanyBatch();//maybe run the batch.
    }

    insertCompanyBatch(force, callback) {
        if (!this.check()) {
            if (callback)
                callback({ succeed: false });
            return;
        }
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
            console.log(q);
            self.connection_.query(q, function (error, results, fields) {
                log._logR('Mysql::insertCompanyBatch', 'Completed with', limit, 'jobs...');
                if (!!error) {
                    console.log(error.stack);
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
        console.log('Mysql::insertCompanyPage', 'cache->', self.queues_.insert_com_page.length);
        self.insertCompanyPageBatch();//maybe run the batch.
    }

    insertCompanyPageBatch(force, callback) {
        if (!this.check()) {
            return;
        }
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
            self.connection_.query(q, htmls, function (error, results, fields) {
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

    screenPendingInsertDatas(datas, callback) {
        //building searching-conditions.
        if (0 == datas.length || !this.check()) {
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
        var func_mv = function (id, brief) {
            for (var d in datas) {
                var data = datas[d];
                if (data.id == id) {
                    brief ? data.brief_exist = true : data.detail_exist = true;
                    break;
                }
            }
        }
        var self = this;
        self.connection_.query(search_brief, function (error, results, fields) {
            if (!error) {
                //fill datas.
                for (var r in results) {
                    func_mv(results[r].id, true);
                }
                //next
                self.connection_.query(search_detail, function (error, results, fields) {
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

