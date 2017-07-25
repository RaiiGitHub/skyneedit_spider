"use strict";
const mysql = require('mysql');
const co = require('co');
const log = require('./log');


class DbOperator {
    constructor(host, user, psw, dbname) {
        this.connection_ = null;
        this.host_ = host;
        this.user_ = user;
        this.psw_ = psw;
        this.dbname_ = dbname;
    }
    config() {
        if (!DbOperator.static_max_con_) {
            DbOperator.static_max_con_ = 8;//max connection.
            DbOperator.static_connections_ = [];
        }
        var cur_con_len_ = DbOperator.static_connections_.length;
        if (cur_con_len_ < 8) {
            DbOperator.static_connections_.push(mysql.createConnection({
                host: this.host_,
                user: this.user_,
                password: this.psw_,
                database: (this.dbname_?this.dbname_:null)
            }));
            //connect right now!
            this.connection_ = DbOperator.static_connections_[cur_con_len_];
            this.connect(true);
        } else {
            var random_index = Math.floor(Math.random()*10)%DbOperator.static_connections_.length;
            this.connection_ = DbOperator.static_connections_[random_index];
        }
    }
    check() {
        if (null == this.connection_) {
            log._logE('Mysql::ensureTablesExist', 'no connection');
            return false;
        }
        return true;
    }
    connect(con) {
        if (null == this.connection_)
            return false;
        var ok = true;
        var message = '';
        var self = this;
        var func_result = function () {
            if (true == ok) {
                log._logR('SQL::', con ? 'Connect' : 'Disconnect', 'OK');
                log._logE('SQL::', con ? 'Connect' : 'Disconnect', 'OK');
                return true;
            } else {
                log._logR('SQL::', con ? 'Connect' : 'Disconnect', 'Error', message);
                log._logE('SQL::', con ? 'Connect' : 'Disconnect', 'Error', message);
                return false;
            }
            return true;
        }
        var func_con = function () {
            con ? self.connection_.connect(function (err) {
                if (err) {
                    message = err.stack;
                    ok = false;
                }
                return func_result();
            }) : self.connection_.end(function (err) {
                if (err) {
                    message = err.stack;
                    ok = false;
                }
                return func_result();
            });
            return true;
        }
        return func_con();
    }
};
module.exports = DbOperator;
