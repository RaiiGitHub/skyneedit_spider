"use strict";
const proxyvisitor = require('./proxyvisitor');
class SearchEmitter{
    //emit all jobs.
    //explainer should be set outside.
    constructor(explainer,dboperator,urlentity){
        this.urlentity_ = urlentity;
        this.porxy_vistor_ = new proxyvisitor;
        this.explainer_ = explainer;
        this.dboperator_ = dboperator;
        this.notify_done_ = null;//function.
    }

    emit(){
        var self = this;
        self.porxy_vistor_.useproxy_ = arguments[0] ? arguments[0] : false;//
        self.notify_done_ = arguments[1] ? arguments[1] : null;//
        self.dboperator_.config();
        self.porxy_vistor_.initVisitor(function(){
            self.explainer_.setupMethod(self);
            self.explainer_.runAsyncTask();
        });
    }
}

module.exports = SearchEmitter;