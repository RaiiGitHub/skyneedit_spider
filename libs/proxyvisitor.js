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
var lock = require('lock')();
class ProxyVisitor {
    //代理访问者
    constructor(cache_name) {
        this.proxyip_ = null;
        this.port_ = null;
        this.serverip_ = null;
        this.wanip_ = null;
        this.body_ = null;
        this.useproxy_ = true;
        this.request_ = null;
        this.guid_ = guid.gen();
        this.request_try_limit_ = 0;
        this.cache_name_ = cache_name;
        if (cache_name)
            fs.mkdir('./datas/' + cache_name, function (err) { });
    }
    initVisitor(callback) {
        var self = this;
        if (!self.useproxy_) {
            log._logR('Proxy', 'Proxy using denined.');
            return;
        }
        lock('proxy', function (release) {
            log._logR('Proxy', '[locked]', 'ready to visit...');
            if (self.request_) {//using last request.
                process.nextTick(
                    release(function () {
                        log._logR('Proxy', 'released', 'using last request.');
                        if (callback)
                            callback();
                    }));
                return;
            }
            //now let's do the task.
            var func_request = function (cb,handler) {
                request(proxyUrl, function (error, response, body) {
                    if (!error && 200 == response.statusCode) {
                        var b = JSON.parse(body);
                        if ('0' == b.status) {
                            console.log('Proxy', 'No IP Resources in the proxy pool,try to reget again...');
                            handler.request_try_limit_++;
                            if (handler.request_try_limit_ > 5000) {
                                log._logR('Proxy', 'No IP Resources and had tried many times,this will be ignored.');
                                log._logE('Proxy', 'No IP Resources and had tried many times,this will be ignored.');
                                if (cb)
                                    cb({ limit: true });
                                return;
                            }
                            //delay time of 1s.
                            setTimeout(function () {
                                process.nextTick(function(){
                                    func_request(cb,handler);
                                });//until get the valid proxy.
                            }, 1 * 1000);
                            return;
                        }
                        var proxyip = b.data.proxyip;
                        handler.proxyip_ = proxyip.match(/(\S*):(\S*)/)[1];
                        handler.port_ = proxyip.match(/(\S*):(\S*)/)[2];
                        handler.serverip_ = b.data.serverip;
                        handler.wanip_ = b.data.wanip;
                        handler.body_ = body;
                        handler.request_try_limit_ = 0;//reset.
                        handler.getProxyRequester();
                        //write it to cache file
                        var cn = handler.cache_name_ ? handler.cache_name_ : 'proxycache';
                        fs.writeFile(printf('./datas/%s/%s.proxy', cn, handler.guid_), body, function (err) {
                            if (err)
                                console.log(err);
                        });
                        log._logR('Proxy', 'proxy request succeed...', body);
                        process.nextTick(
                            release(function () {
                                log._logR('Proxy', 'released','proxy got.');
                                if (cb)
                                    cb();
                            }));
                    } else {
                        log._logR('Proxy', 'initVisitor Failed:', JSON.stringify(error), JSON.stringify(response), 'Retry after 30.');
                        log._logE('Proxy', 'initVisitor Failed:', JSON.stringify(error), JSON.stringify(response), 'Retry after 30s.');
                        setTimeout(function () {
                            process.nextTick(function(){
                                func_request(cb,handler);
                            });
                        }, 30 * 1000);
                    }
                });
            }
            func_request(callback,self);
        });
    }
    visit(options, callback) {
        var self = this;
        if (null == self.request_) {
            log._logR('Proxy', 'visit', 'Not ready yet...');
            setTimeout(function () {
                process.nextTick(function(){
                    self.visit(options,callback);
                });
            }, .5 * 1000);
        } else {
            log._logR('Proxy', 'visit', 'visiting...');
            self.request_(options, callback);
        }
    }
    getProxyRequester() {
        this.request_ = this.useproxy_ ? request
            .defaults({ 'proxy': printf('http://rola:5227@%s:%s', this.proxyip_, this.port_) })
            : request;
        return this.request_;
    }
    refreshVisitor(visitor, callback) {
        var self = visitor ? visitor : this;
        if (!self.useproxy_) {
            log._logR('Proxy', 'Proxy using denined.');
            return false;
        }
        self.releaseVisitor(visitor, function () {
            self.initVisitor(callback);
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
        lock('proxy', function (release) {
            if (!!self.body_) {
                ProxyVisitor.releaseProxy(self.body_, function (b) {
                    self.body_ = null;
                    self.request_ = null;
                    //delete proxy cache file
                    var cn = self.cache_name_ ? self.cache_name_ : 'proxycache';
                    fs.unlink(printf('./datas/%s/%s.proxy', cn, self.guid_), function (err) {
                        if (err)
                            console.log(err);
                        process.nextTick(
                            release(function () {
                                log._logR('Proxy', 'released.');
                                if (callback)
                                    callback();
                            }));
                    });
                });
            } else {
                process.nextTick(
                    release(function () {
                        log._logR('Proxy', 'Already released.');
                        if (callback)
                            callback();
                    }));
            }
        });
    }
    static releaseProxy(body, callback) {
        var options = {
            method: 'POST',
            uri: proxyReleaseUrl,
            body: body
        };
        request(options, function (e, r, b) {
            if (!!e) {
                log._logR('Proxy-Error', 'upload failed:', e);
                log._logE('Proxy-Error', 'upload failed:', e);
                setTimeout(function () {
                    process.nextTick(function(){
                        ProxyVisitor.releaseProxy(body,callback);
                    });//release again...
                }, 30 * 1000);
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
        console.log(proxy_cache_path);
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
            setTimeout(callback, 5 * 1000);
        }
    }

}
module.exports = ProxyVisitor;
