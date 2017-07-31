"use strict";
const mysql = require('mysql');
const printf = require('printf');
const lr = require('line-reader');
const async = require('async');
const dbop = require('../libs/dboperator');
const log = require('../libs/log');

class DbOperatorTYC extends dbop {
    constructor() {
        super('192.168.6.184', 'root', 'admin111', 'tianyancha');
        //super('localhost', 'root', 'admin111', 'tianyancha');
        //super('localhost', 'root', 'mysql', 'tianyancha');
        //insert-cache-ops
        this.insert_com_brief_queue_ = [];
        this.insert_com_page_queue_ = [];
        DbOperatorTYC.cache_size_ = 10;
        DbOperatorTYC.cache_time_out_ = 10;
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
                        `id` int auto_increment primary key COMMENT '自增长的键值',\
                        `code` VARCHAR(100) NOT NULL COMMENT '公司（企业）代码',\
                        `keyName` VARCHAR(255) NULL COMMENT '源于搜索关键字', \
                        `fullName` VARCHAR(255) NULL COMMENT '全称', \
                        `url` VARCHAR(255) NULL COMMENT '详情页面url',\
                        `urlValid` VARCHAR(1) NULL COMMENT '验证页面url是否有效',\
                        `briefDesc` VARCHAR(8192) COMMENT 'Json格式的简明描述',\
                        `recordTime` timestamp NULL DEFAULT '0000-00-00 00:00:00' COMMENT '记录的时间'); ";

        var enterprise_detail = "CREATE TABLE IF NOT EXISTS `enterprise_detail`(\
                        `id` int auto_increment primary key COMMENT '自增长的键值',\
                        `fid` int NOT NULL COMMENT '外键（表enterprise_base）',\
                        `detailDesc` VARCHAR(8192) COMMENT 'Json格式的简明描述',\
                        `html` MEDIUMTEXT NULL COMMENT '详情页面内容', \
                        `recordTime` timestamp NULL DEFAULT '0000-00-00 00:00:00' COMMENT '记录的时间',\
                        foreign key(fid) references enterprise_base(id) ON DELETE CASCADE ON UPDATE RESTRICT);";

        var search_keys = "CREATE TABLE IF NOT EXISTS `search_keys`(\
                        `id` int auto_increment primary key COMMENT '自增长的键值',\
                        `searchKey` VARCHAR(45) NULL COMMENT '搜索关键字',\
                        `memo` VARCHAR(45) NULL COMMENT '备注',\
                        `status` VARCHAR(45) NULL COMMENT '运行状态-running,not start,finished,terminal',\
                        `pageCount` int NULL COMMENT '页面数',\
                        `searchStartTime` timestamp NULL DEFAULT '0000-00-00 00:00:00' COMMENT '搜索开始时间',\
                        `searchEndtTime` timestamp NULL DEFAULT '0000-00-00 00:00:00' COMMENT '搜索结束时间');";

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

    updateSearchKeyStatus(key, status, callback) {
        var self = this;
        if (!self.check()) {
            callback(false);
            return;
        }
        var st = status == 'running' ? ',searchStartTime=NOW()' : '';
        var se = status == 'finished' ? ',searchEndTime=NOW()' : '';
        var q = printf("update search_keys set status = '%s'%s%s where searchKey='%s'", key, st, se);
        self.connection_.query(q, function (error, results, fields) {
            if (!error) {
                log._logE('Mysql::updateSearchKeyStatus', q, error.stack);
                callback(false);
            } else {
                callback(true);
            }
        });
    }

    getSearchKeys(from, count, callback) {
        if (!this.check()) {
            callback(null);
            return;
        }
        var limit = count ? ('limit ' + count) : '';
        var q = printf("SELECT searchKey FROM search_keys where id >= %d %s;", from, limit);
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
        var q = printf("SELECT url,code FROM enterprise_base WHERE %s (urlValid is NULL or urlValid = 1) And id NOT IN(SELECT fid FROM enterprise_detail) %s", condition, limit);
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

    verifyCompanyExists(code, callback) {
        if (!this.check()) {
            callback(false);
            return;
        }
        var q = printf('select 1 from enterprise_base where code = \'%s\' limit 1;', code);
        this.connection_.query(q, function (error, results, fields) {
            if (!error) {
                callback(results.length == 1);
            } else {
                log._logE('Mysql::verifyCompanyExists', q, error.stack);
                callback(false);
            }
        });
    }

    verifyCompanyPageExists(code, callback) {
        if (!this.check()) {
            callback(false);
            return;
        }
        var q = printf('select 1 from enterprise_base a,enterprise_detail b where a.id = b.fid and a.code = \'%s\' limit 1;', code);
        this.connection_.query(q, function (error, results, fields) {
            if (!error) {
                callback(results.length == 1);
            } else {
                log._logE('Mysql::verifyCompanyPageExists', q, error.stack);
                callback(false);
            }
        });
    }

    updateCompanyUrlVerified(code,valid,callback){
        if (!this.check()) {
            callback(false);
            return;
        }
        //valid can be null.
        var q = printf("UPDATE enterprise_base SET urlValid = %s WHERE code = '%s';", !!valid?'NULL':valid,code);
        this.connection_.query(q, function (error, results, fields) {
            if (!error) {
                if( callback )
                    callback(true);
            } else {
                log._logE('Mysql::updateCompanyUrlVerified', q, error.stack);
                if( callback )
                    callback(false);
            }
        });
    }

    insertCompany(desc, callback) {
        if (!this.check()) {
            callback(false);
            return;
        }
        var self = this;
        self.verifyCompanyExists(desc.company_id, function (exists) {
            if (exists) {
                log._logE('Mysql::insertCompany', 'company code with', desc.company_id, 'already exists.');
                console.log('Mysql::insertCompany', 'company code with', desc.company_id, 'already exists.');
                callback(false);
            } else {
                // var q = printf("insert into enterprise_base(code,keyName,fullName,url,briefDesc,recordTime) \
                // select '%s','%s','%s','%s','%s',NOW() from DUAL where not exists \
                // (select id from enterprise_base where code = '%s');",

                //var q = printf("insert into enterprise_base(code,keyName,fullName,url,briefDesc,recordTime) values('%s','%s','%s','%s','%s',NOW());",
                //     desc.company_id, desc.key, desc.company_name, desc.company_detail_url, JSON.stringify(desc), desc.company_id);
                // self.connection_.query(q, function (error, results, fields) {
                //     if (!error) {
                //         callback(true);
                //     } else {
                //         log._logE('Mysql::insertCompany', q, error.stack);
                //         callback(false);
                //     }
                // });
                //put to cache.
                var q = printf("('%s','%s','%s','%s','%s',NOW())",
                    desc.company_id, desc.key, desc.company_name, desc.company_detail_url, JSON.stringify(desc), desc.company_id);
                self.insert_com_brief_queue_.push(q);
                console.log('Mysql::insertCompany', 'cache->', self.insert_com_brief_queue_.length);
                self.insertCompanyBatch();//maybe run the batch.
                callback(true);
            }
        })
    }

    insertCompanyBatch(force) {
        if (!this.check()) {
            callback(false);
            return;
        }
        var self = this;
        var batch_func = function (limit) {
            if (limit <= 0)
                return;
            var coms = [];
            var q = "insert into enterprise_base(code,keyName,fullName,url,briefDesc,recordTime) values";
            for (var i = 0; i < limit; i++) {
                var item = self.insert_com_brief_queue_.splice(0, 1)[0];
                q += item;
                q += (i == limit - 1) ? ';' : ',';
                coms.push([item.html]);
            }
            console.log(q);
            self.connection_.query(q, coms, function (error, results, fields) {
                if (!!error) {
                    console.log(error.stack);
                }
                log._logR('Mysql::insertCompanyBatch', 'Completed with', limit, 'jobs...');
            });
        }
        if (true == force) {
            batch_func(self.insert_com_brief_queue_.length);//batch all.
        }
        else if (DbOperatorTYC.cache_size_ <= self.insert_com_brief_queue_.length) {
            batch_func(DbOperatorTYC.cache_size_);
        } else {
            //setup a timer
            if (0 < self.insert_com_brief_queue_.length) {
                setTimeout(function () {
                    batch_func(self.insert_com_brief_queue_.length);
                }, DbOperatorTYC.cache_time_out_ * 1000);
            }
        }
    }

    insertCompanyPage(desc, html, callback) {
        if (!this.check()) {
            callback(false);
            return;
        }
        var self = this;
        self.verifyCompanyPageExists(desc.company_id, function (exists) {
            if (exists) {
                log._logE('Mysql::insertCompanyPage', 'company code with', desc.company_id, 'already exists.');
                callback(false);
            } else {
                // var fid = printf("(select id from enterprise_base where code='%s' limit 1)", desc.company_id);
                // var insert_params = [html];
                // var q = printf("insert into enterprise_detail(fid,detailDesc,html,recordTime) values(%s,'%s',?,NOW());",
                //     fid, JSON.stringify(desc));
                // self.connection_.query(q, insert_params, function (error, results, fields) {
                //     if (!error) {
                //         log._logR('Mysql::insertCompanyPage','Succeed.');
                //         callback(true);
                //     } else {
                //         log._logE('Mysql::insertCompanyPage', q, error.stack);
                //         callback(false);
                //     }
                // });
                self.insert_com_page_queue_.push({ desc: desc, html: html });
                console.log('Mysql::insertCompanyPage', 'cache->', self.insert_com_page_queue_.length);
                self.insertCompanyPageBatch();//maybe run the batch.
                callback(true);
            }
        })
    }

    insertCompanyPageBatch(force) {
        if (!this.check()) {
            callback(false);
            return;
        }
        var self = this;
        var batch_func = function (limit) {
            if (limit <= 0)
                return;
            var htmls = [];
            var q = "insert into enterprise_detail(fid,detailDesc,html,recordTime) values";
            for (var i = 0; i < limit; i++) {
                var item = self.insert_com_page_queue_.splice(0, 1)[0];
                var fid = printf("(select id from enterprise_base where code='%s' limit 1)", item.desc.company_id);
                q += printf("(%s,'%s',?,NOW())", fid, JSON.stringify(item.desc));
                q += (i == limit - 1) ? ';' : ',';
                htmls.push([item.html]);
            }
            console.log(q);
            self.connection_.query(q, htmls, function (error, results, fields) {
                if (!!error) {
                    console.log(error.stack);
                }
                log._logR('Mysql::insertCompanyPageBatch', 'Completed with', limit, 'jobs...');
            });
        }
        if (true == force) {
            batch_func(self.insert_com_page_queue_.length);
        }
        else if (DbOperatorTYC.cache_size_ <= self.insert_com_page_queue_.length) {
            batch_func(DbOperatorTYC.cache_size_);
        } else {
            //setup a timer
            if (0 > self.insert_com_page_queue_.length) {
                setTimeout(function () {
                    batch_func(self.insert_com_page_queue_.length);
                }, DbOperatorTYC.cache_time_out_ * 1000);
            }
        }
    }
};
module.exports = DbOperatorTYC;

//select TABLE_NAME from INFORMATION_SCHEMA.TABLES where TABLE_NAME='enterprise_base_index';

