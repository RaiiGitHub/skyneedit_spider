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
        self.begin_time_ = (new Date()).valueOf();
        log._logR('Method::Step1', 'Step begin...');
        self.explainer_.emitter_.dboperator_.updateSearchKeyStatus(ue.index_, 'running');//index as the searkey's id.
        self.explainer_.emitter_.dboperator_.updateSearchKeyStatusBatch(true);
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
                log._logR('Method::Step1', 'server err.Query denied in this proxy.');
                refreshproxy();
            }
            else {
                if (proxy.body_)
                    log._logR('Method::Step1', proxy.body_);
                log._logR('Method::Step1', 'innder_index:', self.explainer_.emitter_.inner_index_, 'Time spent in requesting:', (new Date()).valueOf() - self.begin_time_);
                fetcher.fetchPage(self, body, ue.key_, function (count) {
                    //update.
                    self.explainer_.emitter_.dboperator_.updateSearchKeyStatus(ue.index_, 'running', null, null, count);//index as the searkey's id.
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
                            fetcher.fetchBrief(self.next_, export_datas, body, new urlentity(ue.url_, 1, ue.key_), function (ok) {
                                log._logR('Method::Step1', 'Verify url-count:', self.next_.user_data_ ? self.next_.user_data_.size() : 0);
                                if (ok)
                                    self.finish(callback);
                                else {
                                    log._logR('Method::Step1', 'Fetching Failed.', 'May be rejected by the server,refreshing first...');
                                    refreshproxy();
                                }
                            });
                            break;
                        }
                        default: {
                            log._logR('Method::Step1', 'Found', count, 'pages in', ue.url_);
                            //fetch the first page as well.
                            var export_datas = null;
                            fetcher.fetchBrief(self.next_, export_datas, body, new urlentity(ue.url_, 1, ue.key_), function (ok) {
                                log._logR('Method::Step1', 'Verify url-count:', self.next_.user_data_ ? self.next_.user_data_.size() : 0);
                                if (ok)
                                    self.finish(callback);
                                else {
                                    log._logR('Method::Step1', 'Fetching Failed.', 'May be rejected by the server,refreshing first...');
                                    refreshproxy();
                                }
                            });
                            break;
                        }
                    }
                });
            }
        });
    }
};

//step2 is to fetch the rest pages in a sequence.
class MethodStep2 extends explainer.MethodBase {
    sub(callback, cb_parent) {
        log._logR('Method::Step2', 'StepOfSub begin...');
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
        self.sub_task_begin_time_ = (new Date()).valueOf();
        //log._logR('Method::Step2', decode_key);
        var handlefunc = function () {
            up.stamp();
            log._logR('Method::Step2', 'Cur Detail urls Changed:',
                self.user_data_ ? self.user_data_.size() : 0);
            if (up.empty()) {
                self.finish(cb_parent);//notify parent.
                callback(null);
            } else {
                var now_time = (new Date()).valueOf();
                log._logR('Method::Step2', 'innder_index:', self.explainer_.emitter_.inner_index_, 'StepOfSub end,Time spent:', now_time - self.sub_task_begin_time_);
                self.sub_task_begin_time_ = now_time;
                callback(null);
            }
        };
        var refreshproxy = function () {
            if (!proxy.refreshVisitor(null, function (limit) {
                up.insert(ue, 0);//reinput.
                log._logR('Method::Step2', 'Proxy Need to be Refreshed.', !limit ? 'Succeeded.' : 'Failed.');
                self.sub(callback, cb_parent);//redo again.
            })) {
                handlefunc();
            }
        }
        request(options, function (err, res, body) {
            if (err) {
                //time out...
                log._logR('Method::Step2', 'sever err.Query denied in this proxy.');
                refreshproxy();
            } else {
                if (proxy.body_)
                    log._logR('Method::Step2', proxy.body_);
                log._logR('Method::Step2', 'innder_index:', self.explainer_.emitter_.inner_index_, '(StepOfSub)Time spent in requesting:', (new Date()).valueOf() - self.sub_task_begin_time_);
                var export_datas = null;
                fetcher.fetchBrief(self, export_datas, body, ue, function (ok) {
                    if (!ok) {
                        log._logR('Method::Step2', 'proxy may be denined,refreshing...');
                        refreshproxy();
                    } else {
                        handlefunc();
                    }
                }, up.statistics());
            }
        });
    }
    execute(callback) {
        //build task async
        log._logR('Method::Step2', 'Step begin...');
        log._logR('Method::Step2', 'Cur Detail urls Changed:',
            this.user_data_ ? this.user_data_.size() : 0);
        if (null == this.pre_) {
            log._logR('Method::Step2', 'No previous method.');
            callback(null);
            return;
        }
        var self = this;
        this.begin_time_ = (new Date()).valueOf();
        log._logR('Method::Step1', 'innder_index:', self.explainer_.emitter_.inner_index_, 'Time spent:', this.begin_time_ - this.pre_.begin_time_);
        var up = this.pre_.user_data_;
        if (null == up) {
            log._logR('Method::Step2', 'visit denined.');
            callback(null);
            return;
        }
        if (0 < up.container_.length) {
            var tasks = [];
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
};

//step3 is to fetch the detail pages in a sequence,meanwhile,will verify whether the datas were in db or not.
class MethodStep3 extends explainer.MethodBase {
    sub(callback, cb_parent) {
        log._logR('Method::Step3', 'StepOfSub begin...');
        var self = this;
        var up = self.pre_.user_data_;
        var ue = up.popFront();
        if (null == ue) {
            //already empty.
            log._logR('Method::Step3', 'this data is broken,at:',up.size());
            callback(null);
            return;
        }
        var handlefunc = function () {
            up.stamp();
            if (up.empty()) {
                log._logR('Method::Step3', 'No more detail urls...');
                //forcely run batch of inserting company-details.
                var kid = self.explainer_.emitter_.urlentity_.index_;
                self.explainer_.emitter_.dboperator_.insertCompanyPageBatch(true);
                self.explainer_.emitter_.dboperator_.updateSearchKeyStatus(kid, 'finished');//index as the searkey's id.
                self.explainer_.emitter_.dboperator_.updateSearchKeyStatusBatch(true);
                self.finish(cb_parent);//notify parent.
                callback(null);
            } else {
                var now_time = (new Date()).valueOf();
                log._logR('Method::Step3', 'innder_index:', self.explainer_.emitter_.inner_index_, 'StepOfSub end,Time spent:', now_time - self.sub_task_begin_time_);
                self.sub_task_begin_time_ = now_time;
                callback(null);
            }
        };
        var refreshproxy = function () {
            if (!proxy.refreshVisitor(null, function (limit) {
                up.insert(ue, 0);
                log._logR('Method::Step3', 'Proxy Need to be Refreshed.', !limit ? 'Succeeded.' : 'Failed.');
                self.sub(callback, cb_parent);//redo again.
            })) {
                handlefunc();
            }
        }
        if (ue.detail_exist) {
            handlefunc();
            return;
        }
        var proxy = self.explainer_.emitter_.porxy_vistor_;
        var request = proxy.request_;
        var options = {
            url: ue.ue.url_,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64; rv:54.0) Gecko/20100101 Firefox/54.0',
                'Connection': 'keep-alive'
            }
        };

        self.sub_task_begin_time_ = (new Date()).valueOf();
        request(options, function (err, res, body) {
            if (err) {
                log._logR('Method::Step3', 'server err.Query denied in this proxy.');
                refreshproxy();
            } else {
                if (proxy.body_)
                    log._logR('Method::Step3', proxy.body_);
                log._logR('Method::Step3', 'innder_index:', self.explainer_.emitter_.inner_index_, '(StepOfSub)Time spent in requesting:', (new Date()).valueOf() - self.sub_task_begin_time_);
                log._logR('Method::Step3', 'Fetching detail url:', ue.ue.url_, ue.ue.index_, '/', self.detail_url_num_);
                var export_datas = null;
                fetcher.fetchDetail(self, export_datas, body, ue.ue, function (ok) {
                    if (!ok) {
                        log._logR('Method::Step3', 'proxy may be denined,refreshing...');
                        refreshproxy();
                    } else {
                        handlefunc();
                    }
                }, up.statistics());
            }
        });
    }
    execute(callback) {
        log._logR('Method::Step3', 'begin...');
        var self = this;
        if (null == self.pre_) {
            log._logR('Method::Step3', 'No previous method.');
            self.finish(callback);
            return;
        }
        this.begin_time_ = (new Date()).valueOf();
        log._logR('Method::Step2', 'innder_index:', self.explainer_.emitter_.inner_index_, 'Time spent:', this.begin_time_ - this.pre_.begin_time_);
        var up_to_verify = self.pre_.user_data_;
        if (null == up_to_verify) {
            log._logR('Method::Step3', 'visit denined.');
            self.finish(callback);
            return;
        }
        log._logR('Method::Step3', 'urls:', up_to_verify.size());
        //verify datas.
        self.explainer_.emitter_.dboperator_.screenPendingInsertDatas(up_to_verify.container_, function () {
            //insert and fill briefsssss
            for (var d = 0; d < up_to_verify.size(); d++) {
                var utv = up_to_verify.container_[d];
                if (!utv.brief_exist) {
                    self.explainer_.emitter_.dboperator_.insertCompany({brief:utv.brief,key:utv.key});
                }
            }
            self.explainer_.emitter_.dboperator_.insertCompanyBatch(true, function (result) {
                if (false == result.succeed) {
                    var kid = self.explainer_.emitter_.urlentity_.index_;
                    self.explainer_.emitter_.dboperator_.updateSearchKeyStatus(kid, 'failed', null, result.error.stack);//index as the searkey's id.
                    self.explainer_.emitter_.dboperator_.updateSearchKeyStatusBatch(true);
                    log._logR('Method::Step3', 'key:', kid,'stack:',result.error.stack);
                    self.finish(callback);
                } else {
                    //run the fetching of details.
                    self.detail_url_num_ = up_to_verify.size();
                    if (0 < up_to_verify.size()) {
                        var tasks = [];
                        for (var ue in up_to_verify.container_) {
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
            });
        });
    }
};

//final
class MethodStepFinal extends explainer.MethodBase {
    execute(callback) {
        log._logR('Method::Step::final', 'Mission done.');
        this.finish(callback);
    }
};

class ExplainerTYC extends explainer.ExplainerBase {
    setupMethod(emitter) {
        super.setupMethod(emitter);
        this.memo_ = 'explainer of tian yan cha.';
        this.methods_ = [
            new MethodStep1('step1', this),
            new MethodStep2('step2', this),
            new MethodStep3('step3', this),
            new MethodStepFinal('final', this),
        ];
        this.buildMethodDoubleLink();
    }
};

module.exports = ExplainerTYC;