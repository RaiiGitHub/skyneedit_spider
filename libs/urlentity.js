"use strict";
const urlencode = require('urlencode');
const printf = require('printf');

class UrlEntity{
    constructor(u,i,k){
        this.url_ = u;
        this.index_ = i;
        this.key_ = k;
    }
    static encodeUrl(url,charset){
        var cs = arguments[1] ? arguments[1] : 'utf8';
        //utf8,gbk...
        return urlencode(url,cs);
    }
    static decodeUrl(url,charset){
        var cs = arguments[1] ? arguments[1] : 'utf8';
        //utf8,gbk...
        return urlencode.decode(url,cs);
    }
};

module.exports = UrlEntity;
