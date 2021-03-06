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
        self.cookies_ = [];
        //var decode_key = urlentity.decodeUrl(ue.key_);
        var options = {
            url: ue.url_,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64; rv:54.0) Gecko/20100101 Firefox/54.0',
                'Connection': 'keep-alive'
            }
        };
        self.begin_time_ = (new Date()).valueOf();
        log._logR('Method::Step1', self.explainer_.emitter_.inner_index_, 'Step begin...');
        self.explainer_.emitter_.dboperator_.updateSearchKeyStatus(ue.index_, 'running');//index as the searkey's id.
        self.explainer_.emitter_.dboperator_.updateSearchKeyStatusBatch(true);
        //log._logR('Method::Step1', decode_key);
        var refreshproxy = function () {
            if (!proxy.refreshVisitor(null, function () {
                process.nextTick(function () {
                    self.execute(callback);//redo again.
                })
            })) {
                log._logR('Method::Step1', self.explainer_.emitter_.inner_index_, 'UnknownError', 'Hang up...');
            }
        }
        proxy.visit(options, function (err, res, body) {
            if (err) {
                //time out...
                log._logR('Method::Step1', self.explainer_.emitter_.inner_index_, 'server err.Query denied in this proxy.', JSON.stringify(err));
                refreshproxy();
            }
            else {
                if (proxy.body_)
                    log._logR('Method::Step1', self.explainer_.emitter_.inner_index_, proxy.body_);
                log._logR('Method::Step1', self.explainer_.emitter_.inner_index_, 'Time spent in requesting:', (new Date()).valueOf() - self.begin_time_);
                fetcher.fetchPage(self, body, ue.key_, function (count) {
                    //save cookies.
                    self.cookies_ = res.headers["set-cookie"];
                    //update.
                    self.explainer_.emitter_.dboperator_.updateSearchKeyStatus(ue.index_, 'running', null, null, count);//index as the searkey's id.
                    switch (count) {
                        case -1: {
                            log._logR('Method::Step1', self.explainer_.emitter_.inner_index_, 'Query denied in this proxy.');
                            refreshproxy();
                            break;
                        }
                        case 0: {
                            log._logR('Method::Step1', self.explainer_.emitter_.inner_index_, 'Result not found.');
                            self.finish(callback);
                            break;
                        }
                        case 1: {
                            //one page,fetching it right now!
                            log._logR('Method::Step1', self.explainer_.emitter_.inner_index_, 'Found 1 page in', ue.url_);
                            var export_datas = null;
                            fetcher.fetchBrief(self.next_, export_datas, body, new urlentity(ue.url_, 1, ue.key_), function (ok) {
                                log._logR('Method::Step1', self.explainer_.emitter_.inner_index_, 'Verify url-count:', self.next_.user_data_ ? self.next_.user_data_.size() : 0);
                                if (ok)
                                    self.finish(callback);
                                else {
                                    log._logR('Method::Step1', self.explainer_.emitter_.inner_index_, 'Fetching Failed.', 'May be rejected by the server,refreshing first...');
                                    refreshproxy();
                                }
                            });
                            break;
                        }
                        default: {
                            log._logR('Method::Step1', self.explainer_.emitter_.inner_index_, 'Found', count, 'pages in', ue.url_);
                            //fetch the first page as well.
                            var export_datas = null;
                            fetcher.fetchBrief(self.next_, export_datas, body, new urlentity(ue.url_, 1, ue.key_), function (ok) {
                                log._logR('Method::Step1', self.explainer_.emitter_.inner_index_, 'Verify url-count:', self.next_.user_data_ ? self.next_.user_data_.size() : 0);
                                if (ok)
                                    self.finish(callback);
                                else {
                                    log._logR('Method::Step1', self.explainer_.emitter_.inner_index_, 'Fetching Failed.', 'May be rejected by the server,refreshing first...');
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
        var self = this;
        log._logR('Method::Step2', self.explainer_.emitter_.inner_index_, 'StepOfSub begin...');
        var up = self.pre_.user_data_;
        var ue = up.popFront();
        var proxy = self.explainer_.emitter_.porxy_vistor_;
        //var decode_key = urlentity.decodeUrl(ue.key_);
        var options = {
            url: ue.url_,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64; rv:54.0) Gecko/20100101 Firefox/54.0',
                'Connection': 'keep-alive',
                'Cookie': self.cookies_
            }
        };
        self.sub_task_begin_time_ = (new Date()).valueOf();
        //log._logR('Method::Step2', decode_key);
        var handlefunc = function () {
            up.stamp();
            log._logR('Method::Step2', self.explainer_.emitter_.inner_index_, 'Cur Detail urls Changed:',
                self.user_data_ ? self.user_data_.size() : 0);
            if (up.empty()) {
                self.finish(cb_parent);//notify parent.
                callback(null);
            } else {
                var now_time = (new Date()).valueOf();
                log._logR('Method::Step2', self.explainer_.emitter_.inner_index_, 'innder_index:', self.explainer_.emitter_.inner_index_, 'StepOfSub end,Time spent:', now_time - (0 == self.sub_task_begin_time_ ? now_time : self.sub_task_begin_time_));
                self.sub_task_begin_time_ = now_time;
                callback(null);
            }
        };
        var refreshproxy = function () {
            if (!proxy.refreshVisitor(null, function (limit) {
                process.nextTick(function () {
                    up.insert(ue, 0);//reinput.
                    log._logR('Method::Step2', self.explainer_.emitter_.inner_index_, 'Proxy Need to be Refreshed.', !limit ? 'Succeeded.' : 'Failed.');
                    self.sub(callback, cb_parent);//redo again.
                })
            })) {
                log._logR('Method::Step2', self.explainer_.emitter_.inner_index_, 'UnknownError', 'Hang up...');
            }
        }
        proxy.visit(options, function (err, res, body) {
            if (err) {
                //time out...
                log._logR('Method::Step2', self.explainer_.emitter_.inner_index_, 'sever err.Query denied in this proxy.', JSON.stringify(err));
                refreshproxy();
            } else {
                if (proxy.body_)
                    log._logR('Method::Step2', self.explainer_.emitter_.inner_index_, proxy.body_);
                log._logR('Method::Step2', self.explainer_.emitter_.inner_index_, '(StepOfSub)Time spent in requesting:', (new Date()).valueOf() - self.sub_task_begin_time_);
                var export_datas = null;
                fetcher.fetchBrief(self, export_datas, body, ue, function (ok) {
                    if (!ok) {
                        log._logR('Method::Step2', self.explainer_.emitter_.inner_index_, 'proxy may be denined,refreshing...');
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
        var self = this;
        log._logR('Method::Step2', self.explainer_.emitter_.inner_index_, 'Step begin...');
        log._logR('Method::Step2', self.explainer_.emitter_.inner_index_, 'Cur Detail urls Changed:',
            this.user_data_ ? this.user_data_.size() : 0);
        if (null == this.pre_) {
            log._logR('Method::Step2', self.explainer_.emitter_.inner_index_, 'No previous method.');
            callback(null);
            return;
        }
        self.cookies_ = self.pre_.cookies_;
        this.begin_time_ = (new Date()).valueOf();
        log._logR('Method::Step1', self.explainer_.emitter_.inner_index_, 'Time spent:', this.begin_time_ - this.pre_.begin_time_);
        var up = this.pre_.user_data_;
        if (null == up) {
            log._logR('Method::Step2', self.explainer_.emitter_.inner_index_, 'No datas in previous step.');
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
        var self = this;
        log._logR('Method::Step3', self.explainer_.emitter_.inner_index_, 'StepOfSub begin...');
        var up = self.pre_.user_data_;
        var ue = up.popFront();
        if (null == ue) {
            //already empty.
            log._logR('Method::Step3', self.explainer_.emitter_.inner_index_, 'this data is broken,at:', up.size());
            callback(null);
            return;
        }
        var handlefunc = function () {
            up.stamp();
            if (up.empty()) {
                log._logR('Method::Step3', self.explainer_.emitter_.inner_index_, 'No more detail urls...');
                self.finish(cb_parent);//notify parent.
                callback(null);
            } else {
                var now_time = (new Date()).valueOf();
                log._logR('Method::Step3', self.explainer_.emitter_.inner_index_, 'StepOfSub end,Time spent:', now_time - (0 == self.sub_task_begin_time_ ? now_time : self.sub_task_begin_time_));
                self.sub_task_begin_time_ = now_time;
                callback(null);
            }
        };
        var refreshproxy = function () {
            if (!proxy.refreshVisitor(null, function (limit) {
                process.nextTick(function () {
                    up.insert(ue, 0);
                    log._logR('Method::Step3', self.explainer_.emitter_.inner_index_, 'Proxy Need to be Refreshed.', !limit ? 'Succeeded.' : 'Failed.');
                    self.sub(callback, cb_parent);//redo again.
                });
            })) {
                log._logR('Method::Step3', self.explainer_.emitter_.inner_index_, 'UnknownError', 'Hang up...');
            }
        }
        if (ue.detail_exist) {
            handlefunc();
            return;
        }
        var proxy = self.explainer_.emitter_.porxy_vistor_;
        var options = {
            url: ue.ue.url_,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64; rv:54.0) Gecko/20100101 Firefox/54.0',
                'Connection': 'keep-alive',
                'Cookie': self.cookies_
            }
        };

        self.sub_task_begin_time_ = (new Date()).valueOf();
        proxy.visit(options, function (err, res, body) {
            if (err) {
                log._logR('Method::Step3', self.explainer_.emitter_.inner_index_, 'server err.Query denied in this proxy.', JSON.stringify(err));
                refreshproxy();
            } else {
                if (proxy.body_)
                    log._logR('Method::Step3', self.explainer_.emitter_.inner_index_, proxy.body_);
                log._logR('Method::Step3', self.explainer_.emitter_.inner_index_, '(StepOfSub)Time spent in requesting:', (new Date()).valueOf() - self.sub_task_begin_time_);
                log._logR('Method::Step3', self.explainer_.emitter_.inner_index_, 'Fetching detail url:', ue.ue.url_, ue.ue.index_, '/', self.detail_url_num_);
                var export_datas = null;
                fetcher.fetchDetail(self, export_datas, body, ue.ue, function (ok) {
                    if (!ok) {
                        log._logR('Method::Step3', self.explainer_.emitter_.inner_index_, 'proxy may be denined,refreshing...');
                        refreshproxy();
                    } else {
                        handlefunc();
                    }
                }, up.statistics());
            }
        });
    }
    execute(callback) {
        var self = this;
        log._logR('Method::Step3', self.explainer_.emitter_.inner_index_, 'begin...');
        if (null == self.pre_) {
            log._logR('Method::Step3', self.explainer_.emitter_.inner_index_, 'No previous method.');
            self.finish(callback);
            return;
        }
        self.cookies_ = self.pre_.cookies_;
        this.begin_time_ = (new Date()).valueOf();
        log._logR('Method::Step2', self.explainer_.emitter_.inner_index_, 'Time spent:', this.begin_time_ - this.pre_.begin_time_);
        var up_to_verify = self.pre_.user_data_;
        if (null == up_to_verify) {
            log._logR('Method::Step3', self.explainer_.emitter_.inner_index_, 'No datas in previous step.');
            self.finish(callback);
            return;
        }
        log._logR('Method::Step3', self.explainer_.emitter_.inner_index_, 'urls:', up_to_verify.size());
        //verify datas.
        self.explainer_.emitter_.dboperator_.screenPendingInsertDatas(up_to_verify.container_, function () {
            //insert and fill briefsssss
            for (var d = 0; d < up_to_verify.size(); d++) {
                var utv = up_to_verify.container_[d];
                if (!utv.brief_exist) {
                    self.explainer_.emitter_.dboperator_.insertCompany({ brief: utv.brief, key: utv.key });
                }
            }
            self.explainer_.emitter_.dboperator_.insertCompanyBatch(true, function (result) {
                if (false == result.succeed) {
                    var kid = self.explainer_.emitter_.urlentity_.index_;
                    self.explainer_.emitter_.dboperator_.updateSearchKeyStatus(kid, 'failed', null, result.error.stack);//index as the searkey's id.
                    self.explainer_.emitter_.dboperator_.updateSearchKeyStatusBatch(true);
                    log._logR('Method::Step3', self.explainer_.emitter_.inner_index_, 'key:', kid, 'stack:', result.error.stack);
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
                        log._logR('Method::Step3', self.explainer_.emitter_.inner_index_, 'No need to spidering detail datas.');
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
        var self = this;
        log._logR('Method::Step::final', self.explainer_.emitter_.inner_index_, 'Mission done.');
        var kid = self.explainer_.emitter_.urlentity_.index_;
        self.explainer_.emitter_.dboperator_.updateSearchKeyStatus(kid, 'finished');//index as the searkey's id.
        self.explainer_.emitter_.dboperator_.updateSearchKeyStatusBatch(true);
        self.explainer_.emitter_.dboperator_.insertCompanyPageBatch(true);
        self.finish(callback);
    }
};

class ExplainerTYC extends explainer.ExplainerBase {
    setupMethod(emitter) {
        var self = this;
        super.setupMethod(emitter);
        process.on('uncaughtException', function (err) {
            log._logE('Process::uncaughtException', err.stack);
            log._logR('Process::uncaughtException', err.stack);
            log._logR('Process::emit', 'try to emit again!');
            //so let's redo again.
            for(var i in self.methods_ ){
                self.methods_[i].clear();
            }
            process.nextTick(function(){
                emitter.emit(true,emitter.notify_done_);
            })
        });
        self.memo_ = 'explainer of tian yan cha.';
        self.methods_ = [
            new MethodStep1('step1', self),
            new MethodStep2('step2', self),
            new MethodStep3('step3', self),
            new MethodStepFinal('final', self),
        ];
        self.buildMethodDoubleLink();
    }
};

module.exports = ExplainerTYC;