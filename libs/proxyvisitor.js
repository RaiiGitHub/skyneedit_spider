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
    constructor() {
        this.proxyip_ = null;
        this.port_ = null;
        this.serverip_ = null;
        this.wanip_ = null;
        this.body_ = null;
        this.useproxy_ = true;
        this.request_ = request;
        this.guid_ = guid.gen();
    }
    initVisitor(callback) {
        var self = this;
        if (self.useproxy_) {
            request(proxyUrl, function (error, response, body) {
                if (!error && 200 == response.statusCode) {
                    var b = JSON.parse(body);
                    if ('0' == b.status) {
                        log._logR('Proxy', 'No IP Resources in the proxy pool,try to reget again...');
                        self.initVisitor(callback);
                        return;
                    }
                    var proxyip = b.data.proxyip;
                    self.proxyip_ = proxyip.match(/(\S*):(\S*)/)[1];
                    self.port_ = proxyip.match(/(\S*):(\S*)/)[2];
                    self.serverip_ = b.data.serverip;
                    self.wanip_ = b.data.wanip;
                    self.body_ = body;
                    self.getProxyRequester();
                    //write it to cache file
                    fs.writeFile(printf('./datas/proxycache/%s.proxy', self.guid_), body, function (err) {
                        if (err)
                            console.log(err);
                    });
                    if (callback)
                        callback();
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
        return this.request_;
    }
    refreshVisitor(visitor, callback) {
        var self = visitor ? visitor : this;
        if (!self.useproxy_) {
            log._logR('Proxy', 'Proxy using denined.');
            return false;
        }
        self.body_ ? self.releaseVisitor(visitor) : log._logR('Proxy', 'no need to refresh...');
        self.initVisitor(callback);
        return true;
    }
    releaseVisitor(visitor) {
        var self = visitor ? visitor : this;
        if (!self.useproxy_ || !self.body_) {
            log._logR('Proxy', 'Proxy using denined.')
            return;
        }
        ProxyVisitor.releaseProxy(self.body_);
        //delete proxy cache file
        fs.unlink(printf('./datas/proxycache/%s.proxy', self.guid_), function (err) {
            if (err)
                console.log(err);
        });
    }
    static releaseProxy(body) {
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
            log._logR('Proxy', 'proxy released...', b);
        })
    }
    static releaseAllProxies(callback) {
        //读取文件目录
        var proxy_cache_path = './datas/proxycache/';
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
                    log._logR('Proxy', 'Released', body);
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
