"use strict";
const mysql = require('mysql');
const async = require('async');
const socket = require('./socket');

class DbOperator {
    constructor(host, user, psw, dbname, is_holder) {
        var self = this;
        self.host_ = host;
        self.user_ = user;
        self.psw_ = psw;
        self.dbname_ = dbname;
        self.is_connected_ = false;
        self.connection_ = mysql.createConnection({
            host: host,
            port: 3306,
            user: user,
            password: psw,
            database: dbname
        });
        self.is_holder_ = is_holder;
        // if (true == is_holder) {
        //     self.connection_ = mysql.createConnection({
        //         host: host,
        //         port: 3306,
        //         user: user,
        //         password: psw,
        //         database: dbname
        //     });
        //     self.socket_server_ = new socket.SocketServer(8194);
        //     self.socket_server_.injectEvent('query',function(client,sql,args){
        //         self._query(sql,args,function(e,r,f){
        //             //now should echo to the client.
        //             client.emit('query',[e,r,f]);
        //         });
        //     });
        // }
    }
    connect() {
        if (this.is_connected_)
            return;
        this.connection_.connect();
        this.is_connected_ = true;
    }
    end() {
        if (!this.is_connected_)
            return;
        this.connection_.end();
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
                    arr[arr.length] = func(i, sqls, args, opt);
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
