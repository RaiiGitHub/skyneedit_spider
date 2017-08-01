"use strict";
class SearchEmitter {
    //emit all jobs.
    //explainer should be set outside.
    constructor(dboperator,proxyvisitor,innerindex,explainer,urlentity) {
        this.dboperator_ = dboperator;
        this.porxy_vistor_ = proxyvisitor;
        this.inner_index_ = innerindex;//inner index.
        this.explainer_ = explainer;
        this.urlentity_ = urlentity;
        this.notify_done_ = null;//function.
    }

    emit() {
        var self = this;
        self.porxy_vistor_.useproxy_ = arguments[0] ? arguments[0] : false;//
        self.notify_done_ = arguments[1] ? arguments[1] : null;//
        self.dboperator_.config();
        self.porxy_vistor_.initVisitor(function (result) {
            if (result && result.limit) {
                //failed.
                if (self.notify_done_) {
                    self.notify_done_(false);
                }
            } else {
                self.explainer_.setupMethod(self);
                self.explainer_.runAsyncTask();
            }
        });
    }

    ensureReleaseProxy() {
        if (this.porxy_vistor_ && this.porxy_vistor_.useproxy_) {
            this.porxy_vistor_.releaseVisitor();
        }
    }
}

module.exports = SearchEmitter;
