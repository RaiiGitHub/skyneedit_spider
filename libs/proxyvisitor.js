"use strict";
const request = require('request');
const printf = require('printf');
const fs = require('fs');
const log = require('./log');
const guid = require('./guidgen');
const urlentity = require('./urlentity');
const proxyBaseUrl = 'http://192.168.6.110';
const proxyUrl = proxyBaseUrl + '/ip/getInfo/';
//const proxyUrl = proxyBaseUrl + '/ip/getInfo?type=' + urlentity.encodeUrl('衢州市');
const proxyReleaseUrl = proxyBaseUrl + '/ip/reDial/';
class ProxyVisitor {
    //代理访问者
    constructor(cache_name) {
        this.proxyip_ = null;
        this.port_ = null;
        this.serverip_ = null;
        this.wanip_ = null;
        this.body_ = null;
        this.useproxy_ = true;
        this.request_ = request;
        this.guid_ = guid.gen();
        this.request_try_limit_ = 0;
        this.requesting_ = false;
        this.refreshing_ = false;
        this.cache_name_ = cache_name;
        if (cache_name)
            fs.mkdir('./datas/' + cache_name, function (err) { });
    }
    initVisitor(callback) {
        var self = this;
        if (self.useproxy_) {
            var waiting = false;
            while (self.requesting_) {
                //just wait...
                waiting = true;
                console.log('initVisitor waiting...');
            }
            if (waiting) {
                if (callback)
                    callback();
                return;
            }
            if (ProxyVisitor.static_request_) {//using last request.
                self.request_ = ProxyVisitor.static_request_;
                if (callback)
                    callback();
                return;
            }
            self.requesting_ = true;
            request(proxyUrl, function (error, response, body) {
                self.requesting_ = false;
                if (!error && 200 == response.statusCode) {
                    var b = JSON.parse(body);
                    if ('0' == b.status) {
                        console.log('Proxy', 'No IP Resources in the proxy pool,try to reget again...');
                        self.request_try_limit_++;
                        if (self.request_try_limit_ > 5000) {
                            log._logR('Proxy', 'No IP Resources and had tried many times,this will be ignore.');
                            if (callback)
                                callback({ limit: true });
                            return;
                        }
                        self.initVisitor(function () {
                            if (callback)
                                callback();
                        });
                        return;
                    }
                    var proxyip = b.data.proxyip;
                    self.proxyip_ = proxyip.match(/(\S*):(\S*)/)[1];
                    self.port_ = proxyip.match(/(\S*):(\S*)/)[2];
                    self.serverip_ = b.data.serverip;
                    self.wanip_ = b.data.wanip;
                    self.body_ = body;
                    self.request_try_limit_ = 0;//reset.
                    self.getProxyRequester();
                    //write it to cache file
                    var cn = self.cache_name_ ? self.cache_name_ : 'proxycache';
                    fs.writeFile(printf('./datas/%s/%s.proxy', cn, self.guid_), body, function (err) {
                        if (err)
                            console.log(err);
                    });
                    log._logR('Proxy', 'proxy request succeed...', body);
                    if (callback)
                        callback();
                } else {
                    console.log('Proxy', 'initVisitor Failed:', self);
                }
            });
        }
        else {
            if (callback)
                callback();
        }
    }
    getProxyRequester() {
        this.request_ = this.useproxy_ ? request
            .defaults({ 'proxy': printf('http://rola:5227@%s:%s', this.proxyip_, this.port_) })
            : request;
        ProxyVisitor.static_request_ = this.request_;
        return this.request_;
    }
    refreshVisitor(visitor, callback) {
        var self = visitor ? visitor : this;
        if (!self.useproxy_) {
            log._logR('Proxy', 'Proxy using denined.');
            return false;
        }
        ProxyVisitor.static_request_ = null;
        self.releaseVisitor(visitor, function () {
            self.initVisitor(function () {
                if (callback)
                    callback();
            });
        });
        return true;
    }
    releaseVisitor(visitor, callback) {
        var self = visitor ? visitor : this;
        if (!self.useproxy_) {
            log._logR('Proxy', 'Proxy using denined.')
            if (callback)
                callback();
            return;
        }
        var waiting = false;
        while (self.refreshing_) {
            //just wait...
            waiting = true;
            console.log('releaseVisitor waiting...');
        }
        if (waiting) {
            if (callback)
                callback();
            return;
        }
        if (!self.body_) {
            log._logR('Proxy', 'Proxy released already.')
            if (callback)
                callback();
            return;
        }
        self.refreshing_ = true;
        ProxyVisitor.releaseProxy(self.body_, function (b) {
            self.body_ = null;
            self.refreshing_ = false;
            //delete proxy cache file
            var cn = self.cache_name_ ? self.cache_name_ : 'proxycache';
            fs.unlink(printf('./datas/%s/%s.proxy', cn, self.guid_), function (err) {
                if (err)
                    console.log(err);
                if (callback)
                    callback(b);
            });
        });
    }
    static releaseProxy(body, callback) {
        var options = {
            method: 'POST',
            uri: proxyReleaseUrl,
            body: body
        };
        request(options, function (e, r, b) {
            if (e) {
                log._logR('Proxy-Error', 'upload failed:', e);
                log._logE('Proxy-Error', 'upload failed:', e);
                return;
            }
            log._logR('Proxy', 'proxy released...', b, body);
            if (callback) {
                callback(b);
            }
        })
    }
    static releaseAllProxies(callback, name) {
        //读取文件目录
        var cn = name ? name : 'proxycache';
        var proxy_cache_path = './datas/' + cn + '/';
        fs.readdir(proxy_cache_path, function (err, files) {
            if (err) {
                console.log(err);
                if (callback)
                    callback();
                return;
            }
            var count = files.length;
            files.forEach(function (filename) {
                fs.readFile(proxy_cache_path + filename, 'utf8', function (err, body) {
                    ProxyVisitor.releaseProxy(body);
                    fs.unlink(proxy_cache_path + filename, function (err) {
                        if (err)
                            console.log(err);
                    });
                });
            });
        });
        if (callback) {
            log._logR('Proxy', 'will exit after 5s.');
            setTimeout(function () {
                callback();
            }, 5 * 1000);
        }
    }

}
module.exports = ProxyVisitor;
