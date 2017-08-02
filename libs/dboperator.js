"use strict";
const mysql = require('mysql');
const co = require('co');
const log = require('./log');


class DbOperator {
    constructor(host, user, psw, dbname) {
        this.host_ = host;
        this.user_ = user;
        this.psw_ = psw;
        this.dbname_ = dbname;
        this.pool_ = mysql.createPool({
                host: this.host_,
                user: this.user_,
                password: this.psw_,
                database: this.dbname_,
                port: 3306
            });
    }
    check(){
        return !!this.pool_;
    }
};
module.exports = DbOperator;
