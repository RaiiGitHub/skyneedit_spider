"use strict";
const urlencode = require('urlencode');
const printf = require('printf');
const urlentity = require('./urlentity');
const container = require('./container');

class UrlPool extends container {
    //url存取池
    constructor(){
        super();
        this.run_time_accu_ = 0;
        this.run_time_last_ = 0;
    }

    static verifyUrlInPool(url,needencode,charset) {
        if( true == needencode )
            urlentity.encodeUrl(url,charset);
        for( var u in this.data_pack_ ){
            if( this.data_pack_[u].url == url)
                return true;
        }
        return false;
    }

    //@overwrite.
    check(ele){
        //need to be overwritten.
        if( super.check(ele) )
            return true;
        for( var u in this.container_ ){
            if( this.container_[u].url_ == ele.url_)
                return true;
        }
        return false;
    }
    //record a time stamp.
    stamp(){
        var cur = (new Date()).valueOf(); 
        if( 0 == this.run_time_last_ ){
            this.run_time_accu_ = 0 ;
        }else{
            this.run_time_accu_ += cur - this.run_time_last_;
        }
        this.run_time_last_ = cur;
    }
    //return current statistics time.
    statistics(){
        return {
            elipse : this.run_time_accu_,
            last : this.run_time_last_
        };
    }
};

module.exports = UrlPool;
