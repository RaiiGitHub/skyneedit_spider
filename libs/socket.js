"use strict";
//a socket using for data-transmission.
class SocketServer {
    constructor(port) {
        this.bind_port_ = !!port ? port : 8194;
        this.server_ = null;
        this.io_ = null;
        this.eventHandlers_ = [];
    }
    injectEvent(event, handler, args) {
        //this will listen from all the client with the same event-name.
        this.eventHandlers_.push({ event: event, handler: handler, args: args });
    }
    startup() {
        //here the server will not be limited,that means the caller should know why to startup.
        //usaully,it is startup in a master-process. 
        var self = this;
        if (!!self.server_)
            return;//already created.
        self.server_ = require('http').createServer();
        self.io_ = require('socket.io')(server);
        self.io_.on('connection', function (client) {
            console.log('new client\'s coming...', client.id);
            for (var e in self.eventHandlers_) {
                client.on(self.eventHandlers_[e].event, function (data) {
                    self.eventHandlers_[e].handler(client, data, args);//handle the data right now!May emit the data back to the client.
                });
            }
        });
        server.listen(this.bind_port_);
    }
};

class SocketClient {
    constructor(port) {
        this.bind_port_ = !!port ? port : 8194;
        this.client_ = null;
    }
    startup() {
        var self = this;
        if (!!self.client_)
            return;//already created.
        self.client_ = require('socket.io-client')('http://localhost:' + this.bind_port_);
    }
    emit(event, data, callback) {
        var self = this;
        if (null == self.client_)
            return;
        self.client_.emit(event, data);
        self.client_.on(event, function (data) {
            if (callback)
                callback(data);
        });
    }
};
module.exports = {
    SocketServer,
    SocketClient
};
