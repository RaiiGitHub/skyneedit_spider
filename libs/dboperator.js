"use strict";
const mysql = require('mysql');
const async = require('async');

class DbOperator {
    constructor(host, user, psw, dbname) {
        this.host_ = host;
        this.user_ = user;
        this.psw_ = psw;
        this.dbname_ = dbname;
        this.is_connected_ = false;
        this.connection_ = mysql.createConnection({
            host: this.host_,
            port: 3306,
            user: this.user_,
            password: this.psw_,
            database: this.dbname_
        });
    }
    connect() {
        if (this.is_connected_)
            return;
        this.connection_.connect();
        this.is_connected_ = true;
    }
    end(){
        if( !this.is_connected_ )
            return;
        self.connection_.end();
        this.is_connected_ = false;
    }
    query(sql, args, callback) {
        var self = this;
        if (!self.is_connected_) {
            self.connect();
        }
        self.connection_.query(sql, args, function (error, results, fields) {
            callback(error, results, fields);
        });
    }
    queries(sqls, args, opt, callback) {
        var self = this;
        if (!self.is_connected_) {
            self.connect();
        }
        if (callback === undefined) {
            callback = opt;
        }
        self.connection_.beginTransaction(function (err) {
            if (!!err) {
                callback(err);
            } else {
                var arr = [], results = [],
                    func = function (i, queries, args, opt) {
                        return function (cb) {
                            var skip = false;
                            if (!!opt && typeof opt.skip === 'function') {
                                try {
                                    skip = opt.skip(i, args[i], results, cb);
                                } catch (e) {
                                    cb(e);
                                    return;
                                }
                            }
                            if (!skip) {
                                self.connection_.query(queries[i], args[i], function (err, rs) {
                                    results[i] = rs;
                                    cb(err, rs);
                                });
                            } else {
                                cb();
                            }
                        };
                    };
                for (var i = 0; i < sqls.length; i++) {
                    arr[arr.length] = func( i, sqls, args, opt);
                }
                async.series(arr, function (err, results) {
                    if (!!err) {
                        self.connection_.rollback();
                    } else {
                        self.connection_.commit(function (err) {
                            if (!!err) {
                                self.connection_.rollback();
                            }
                        });
                    }
                    callback(err, results);
                });
            }
        });
    }
};
module.exports = DbOperator;
