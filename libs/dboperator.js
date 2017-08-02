"use strict";
const mysql = require('mysql');
class DbOperator {
    constructor(host, user, psw, dbname) {
        this.host_ = host;
        this.user_ = user;
        this.psw_ = psw;
        this.dbname_ = dbname;
    }
    check() {
        return !!this.pool_;
    }
    begin() {
        if( this.check() )
            return;
        this.pool_ = mysql.createPool({
            host: this.host_,
            user: this.user_,
            password: this.psw_,
            database: this.dbname_,
            port: 3306,
            connectionLimit: 1,
        });
    }
    end() {
        if (!this.check()) {
            return;
        }
        this.pool_.end();
        this.pool_ = null;
    }
};
module.exports = DbOperator;
