"use strict";
const cheerio = require('cheerio');
const printf = require('printf');
const async = require('async');
const urlentity = require('../libs/urlentity');
const urlpool = require('../libs/urlpool');
const log = require('../libs/log');
const explainer = require('../libs/explainer');
const fetcher = require('./tyc_fetcher');

//step1 is to get the urls from db that need to be fetched.
//build the async tasks.
class MethodStep1 extends explainer.MethodBase {
    execute(callback) {
        var self = this;
        var proxy = self.explainer_.emitter_.porxy_vistor_;
        var request = proxy.request_;
        var dbop = self.explainer_.emitter_.dboperator_;
        var keys = self.explainer_.keys_;
        log._logR('Method::Step1', 'begin...');
        if (keys) {
            log._logR('Method::Step1', 'Found', keys.length, 'Unfinished details.begin...');
            self.user_data_ = keys;
            self.finish(callback);//to next.
        } else {
            //failed.toggle to next.
            log._logR('Method::Step1', 'Detail URL Results Not Found');
            self.finish(callback);
        }
    }
};

//methods of step 2 is the fetch the detail pages in a sequence,urls came from step1.
class MethodStep2 extends explainer.MethodBase {
    sub(callback, cb_parent) {
        var self = this;
        var up = self.user_data_;
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
            if (up.empty()) {
                log._logR('Method::Step2', 'No more detail urls...');
                self.finish(cb_parent);//notify parent.
                callback(null);
            } else {
                callback(null);
            }
        };
        var refreshproxy = function () {
            if (!proxy.refreshVisitor(null, function (limit) {
                up.insert(ue, 0);
                log._logR('Method::Step2', 'Proxy Need to be Refreshed.', !limit ? 'Succeeded.' : 'Failed.');
                self.sub(callback, cb_parent);//redo again.
            })) {
                handlefunc();
            }
        }
        request(options, function (err, res, body) {
            if (err) {
                log._logE('Method::Step2', 'server err.Query denied in this proxy.');
                log._logR('Method::Step2', 'server err.Query denied in this proxy.');
                refreshproxy();
            } else {
                if (proxy.body_)
                    log._logR('Method::Step2', proxy.body_);
                log._logR('Method::Step2', 'Fetching detail url:', ue.url_, ue.index_, '/', self.detail_url_num_);
                var export_datas = null;
                fetcher.fetchDetail(self, export_datas, body, ue, function (ok) {
                    if (!ok) {
                        log._logE('Method::Step2', 'proxy may be denined,refreshing...');
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
        log._logR('Method::Step2', 'begin...');
        var self = this;
        if (null == self.pre_) {
            log._logE('Method::Step2', 'No previous method.');
            log._logR('Method::Step2', 'No previous method.');
            self.finish(callback);
            return;
        }
        var fetch_list = self.pre_.user_data_;
        if (null == fetch_list) {
            log._logE('Method::Step2', 'visit denined.');
            log._logR('Method::Step2', 'visit denined.');
            self.finish(callback);
            return;
        }
        self.detail_url_num_ = fetch_list.length;
        //check whether exists sub tasks.
        if (0 < fetch_list.length) {
            var tasks = [];
            self.user_data_ = new urlpool;
            for (var i in fetch_list) {
                var item = fetch_list[i];
                self.user_data_.add(new urlentity(item.url, parseInt(i) + 1, printf('x.detail.%s.x', item.id)));
                console.log('Method::Step2', 'Building index:', parseInt(i) + 1, '/', fetch_list.length,item.id,item.url);
                tasks.push(function (cb_sub) {
                    self.sub(cb_sub, callback);
                });
            }
            async.waterfall(tasks, function (err, result) {
                //need to be done in the callback funcions.
            });
        } else {
            log._logR('Method::Step2', 'No need to spidering detail datas.');
            self.finish(callback);
        }
    }
};

class MethodStepFinal extends explainer.MethodBase {
    execute(callback) {
        console.log('Method::Step::final', 'Mission done.');
        this.finish(callback);
    }
};

class ExplainerDetailFetcherTYC extends explainer.ExplainerBase {
    constructor(keys) {
        super();
        this.keys_ = keys;
    }
    setupMethod(emitter) {
        super.setupMethod(emitter);
        this.memo_ = 'explainer of detail-pages in tian yan cha.';
        this.methods_ = [
            new MethodStep1('step1', this),
            new MethodStep2('Step2', this),
            new MethodStepFinal('final', this)
        ];
        this.buildMethodDoubleLink();
    }
};

module.exports = ExplainerDetailFetcherTYC;