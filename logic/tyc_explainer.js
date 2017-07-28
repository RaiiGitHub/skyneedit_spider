"use strict";
const cheerio = require('cheerio');
const printf = require('printf');
const async = require('async');
const urlentity = require('../libs/urlentity');
const urlpool = require('../libs/urlpool');
const log = require('../libs/log');
const explainer = require('../libs/explainer');
const fetcher = require('./tyc_fetcher');

//methods.
//http://www.tianyancha.com/search?key=%s
//step1 is to fetch pages.
class MethodStep1 extends explainer.MethodBase {
    execute(callback) {
        var self = this;
        var ue = self.explainer_.emitter_.urlentity_;
        var proxy = self.explainer_.emitter_.porxy_vistor_;
        var request = proxy.request_;
        //var decode_key = urlentity.decodeUrl(ue.key_);
        var options = {
            url: ue.url_,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64; rv:54.0) Gecko/20100101 Firefox/54.0',
                'Connection': 'keep-alive'
            }
        };
        log._logR('Method::Step1', 'begin...');
        //log._logR('Method::Step1', decode_key);
        var refreshproxy = function () {
            if (!proxy.refreshVisitor(null, function () {
                self.execute(callback);//redo again.
            })) {
                self.finish(callback);
            }
        }
        request(options, function (err, res, body) {
            if (err) {
                //time out...
                log._logE('Method::Step1', 'server err.Query denied in this proxy.');
                log._logR('Method::Step1', 'server err.Query denied in this proxy.');
                refreshproxy();
            }
            else if (res.statusCode == 200) {
                if (proxy.body_)
                    log._logR('Method::Step1', proxy.body_);
                fetcher.fetchPage(self, body, ue.key_, function (count) {
                    switch (count) {
                        case -1: {
                            log._logR('Method::Step1', 'Query denied in this proxy.');
                            refreshproxy();
                            break;
                        }
                        case 0: {
                            log._logR('Method::Step1', 'Result not found.');
                            self.finish(callback);
                            break;
                        }
                        case 1: {
                            //one page,fetching it right now!
                            log._logR('Method::Step1', 'Found 1 page in', ue.url_);
                            var export_datas = null;
                            fetcher.fetchBrief(self.next_, export_datas, body, ue, function (ok) {
                                log._logR('Method::Step1', 'Cur Detail urls Changed:',
                                    self.next_.user_data_ ? self.next_.user_data_.size() : 0);
                                self.finish(callback);
                            });
                            break;
                        }
                        default: {
                            log._logR('Method::Step1', 'Found', count, 'pages in', ue.url_);
                            //fetch the first page as well.
                            var export_datas = null;
                            fetcher.fetchBrief(self.next_, export_datas, body, ue, function (ok) {
                                log._logR('Method::Step1', 'Cur Detail urls Changed:',
                                    self.next_.user_data_ ? self.next_.user_data_.size() : 0);
                                self.finish(callback);
                            });
                            break;
                        }
                    }
                });
            }else{
                //redo again.
                log._logR('Method::Step1', 'Fetching Failed.','Redo again,refreshing first...');
                refreshproxy();
            }
        });
    }
}

//step2 is to fetch the rest pages in a sequence.
class MethodStep2 extends explainer.MethodBase {
    sub(callback, cb_parent) {
        var self = this;
        var up = self.pre_.user_data_;
        var ue = up.popFront();
        var proxy = self.explainer_.emitter_.porxy_vistor_;
        var request = proxy.request_;
        //var decode_key = urlentity.decodeUrl(ue.key_);
        var options = {
            url: ue.url_,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64; rv:54.0) Gecko/20100101 Firefox/54.0',
                'Connection': 'keep-alive'
            }
        };
        //log._logR('Method::Step2', decode_key);
        var handlefunc = function () {
            up.stamp();
            log._logR('Method::Step2', 'Cur Detail urls Changed:',
                self.user_data_ ? self.user_data_.size() : 0);
            if (up.empty()) {
                self.finish(cb_parent);//notify parent.
                callback(null);
            } else {
                callback(null);
            }
        };
        var refreshproxy = function () {
            if (!proxy.refreshVisitor(null, function (limit) {
                up.insert(ue, 0);//reinput.
                log._logE('Method::Step2', 'Proxy Need to be Refreshed.', !limit?'Succeeded.':'Failed.');
                self.sub(callback, cb_parent);//redo again.
            })) {
                handlefunc();
            }
        }
        request(options, function (err, res, body) {
            if (err) {
                //time out...
                log._logE('Method::Step2', 'sever err.Query denied in this proxy.');
                log._logR('Method::Step2', 'sever err.Query denied in this proxy.');
                refreshproxy();
            } else if (res.statusCode == 200) {
                if (proxy.body_)
                    log._logR('Method::Step2', proxy.body_);
                var export_datas = null;
                fetcher.fetchBrief(self, export_datas, body, ue, function (ok) {
                    if (!ok) {
                        log._logE('Method::Step2', 'proxy may be denined,refreshing...');
                        log._logR('Method::Step2', 'proxy may be denined,refreshing...');
                        refreshproxy();
                    } else {
                        handlefunc();
                    }
                }, up.statistics());
            } else {
                //need to redo again...
                log._logE('Method::Step2', 'Fetching Error...', 'Redo again,refreshing first...');
                refreshproxy();
            }
        });
    }
    execute(callback) {
        //build task async
        log._logR('Method::Step2', 'Cur Detail urls Changed:',
            this.user_data_ ? this.user_data_.size() : 0);
        if (null == this.pre_) {
            log._logE('Method::Step2', 'No previous method.');
            log._logR('Method::Step2', 'No previous method.');
            callback(null);
            return;
        }
        var up = this.pre_.user_data_;
        var up = this.pre_.user_data_;
        if (null == up) {
            log._logE('Method::Step2', 'visit denined.');
            log._logR('Method::Step2', 'visit denined.');
            callback(null);
            return;
        }
        if (0 < up.container_.length) {
            var tasks = [];
            var self = this;
            for (var ue in up.container_) {
                tasks.push(function (cb_sub) {
                    self.sub(cb_sub, callback);
                });
            }
            async.waterfall(tasks, function (err, result) {
            });
        } else {
            callback(null);
        }
    }
}

//step3 is to fetch the detail pages in a sequence.
class MethodStep3 extends explainer.MethodBase {
    sub(callback, cb_parent) {
        var self = this;
        var up = self.pre_.user_data_;
        var ue = up.popFront();
        var proxy = self.explainer_.emitter_.porxy_vistor_;
        var request = proxy.request_;
        //var decode_key = urlentity.decodeUrl(ue.key_);
        var options = {
            url: ue.url_,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64; rv:54.0) Gecko/20100101 Firefox/54.0',
                'Connection': 'keep-alive'
            }
        };
        //log._logR('Method::Step3', decode_key);
        var handlefunc = function () {
            up.stamp();
            if (up.empty()) {
                log._logR('Method::Step3', 'No more detail urls...');
                self.finish(callback);//notify parent.
            } else {
                log._logR('Method::Step3', 'Fetching next detail url:', ue.url_, ue.index_, '/', self.detail_url_num_);
                if (ue.index_ == self.detail_url_num_)
                    self.finish(cb_parent);
                callback(null);
            }
        };
        var refreshproxy = function () {
            if (!proxy.refreshVisitor(null, function (limit) {
                up.insert(ue, 0);
                log._logE('Method::Step3', 'Proxy Need to be Refreshed.', !limit?'Succeeded.':'Failed.');
                self.sub(callback, cb_parent);//redo again.
            })) {
                handlefunc();
            }
        }
        request(options, function (err, res, body) {
            if (err) {
                log._logE('Method::Step3', 'server err.Query denied in this proxy.');
                log._logR('Method::Step3', 'server err.Query denied in this proxy.');
                refreshproxy();
            } else if (res.statusCode == 200) {
                if (proxy.body_)
                    log._logR('Method::Step3', proxy.body_);
                var export_datas = null;
                fetcher.fetchDetail(self.pre_, export_datas, body, ue, function (ok) {
                    if (!ok) {
                        log._logE('Method::Step3', 'proxy may be denined,refreshing...');
                        log._logR('Method::Step3', 'proxy may be denined,refreshing...');
                        refreshproxy();
                    } else {
                        handlefunc();
                    }
                }, up.statistics());
            } else {
                log._logE('Method::Step3', 'Fetching Error...', 'Redo again,refreshing first...');
                refreshproxy();
            }
        });
    }
    execute(callback) {
        //build task async
        log._logR('Method::Step3', 'begin...');
        var self = this;
        if (null == self.pre_) {
            log._logE('Method::Step3', 'No previous method.');
            log._logR('Method::Step3', 'No previous method.');
            self.finish(callback);
            return;
        }
        var up = self.pre_.user_data_;
        if (null == up) {
            log._logE('Method::Step3', 'visit denined.');
            log._logR('Method::Step3', 'visit denined.');
            self.finish(callback);
            return;
        }
        self.detail_url_num_ = up.container_.length;

        //check whether exists sub tasks.
        if (0 < up.container_.length) {
            var tasks = [];
            for (var ue in up.container_) {
                tasks.push(function (cb_sub) {
                    self.sub(cb_sub, callback);
                });
            }
            async.waterfall(tasks, function (err, result) {
                //need to be done in the callback funcions.
            });
        } else {
            log._logR('Method::Step3', 'No need to spidering detail datas.');
            self.finish(callback);
        }
    }
}

class ExplainerTYC extends explainer.ExplainerBase {
    setupMethod(request, emitter) {
        super.setupMethod(request, emitter);
        this.memo_ = 'explainer of tian yan cha.';
        this.methods_ = [
            new MethodStep1('step1', this),
            new MethodStep2('step2', this),
            new MethodStep3('step3-final', this)
        ];
        this.buildMethodDoubleLink();
    }
};

module.exports = ExplainerTYC;