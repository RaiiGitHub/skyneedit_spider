const printf = require('printf');
const fs = require('fs');
const urlentity = require('./libs/urlentity');
const explainer = require('./logic/tyc_explainer');
const pv = require('./libs/proxyvisitor');
const dbop = require('./logic/tyc_dboperator');
const emitter = require('./libs/searchemitter');
const log = require('./libs/log');
const cluster = require('cluster');
const async = require('async');

function onexit() {
  log._logR('Main::Exit', 'Got SIGINT.  Release all proxies before exiting...');
  pv.releaseAllProxies(function () {
    log._logR('Main::Exit', 'Bye.');
    process.exit(0);
  }, 'proxycache');
}

log.init('./datas/logs/fetch-unfinished', 'NORMAL', 'Windows', 'TYCFetcher');
if (cluster.isMaster) {
  process.on('SIGINT', function () {
    onexit();
  });
  var process_args = process.argv.splice(2);
  if (1 > process_args.length) {
    log._logR('Main::EntryPoint', 'argument workers should be here.');
    return;
  }
  var ws = parseInt(process_args[0]);
  var db = new dbop();
  db.resetAbnormalSearchKey(function (ok) {
    if (true == ok) {
      db.getUnfinishedSearchKeys(function (results) {
        var ave = parseInt(results.length / ws);
        var index = 0;
        log._logR('Main::Assign', ws, '*', ave);
        for (var i = 0; i < ws; i++) {
          var wp = cluster.fork();//work process.
          var keys = [];
          if (i == ws - 1) {
            for (; index < results.length; ++index) {
              keys.push(results[index]);
            }
          } else {
            for (; index <= (i + 1) * ave; ++index)
              keys.push(results[index]);
          }
          log._logR('Main::Offset', index);
          log._logR('Main::Keys', JSON.stringify(keys));
          wp.send({ keys: keys });
        }
        db.end();
      });
    }
  })
} else {
  var proxyvistor = new pv;
  var db = new dbop();
  var keys = [];
  var main = function (callback) {
    var key = keys.pop();
    var fetch = printf('%d.%s', key.id, key.searchKey);
    log._logR('Main::Log', log.processID, 'fetch:', fetch, 'Ready to log...');
    var k = key.searchKey;
    var kid = key.id;
    var e = new emitter(
      db,
      proxyvistor,
      fetch,
      new explainer,
      new urlentity(printf('http://www.tianyancha.com/search?key=%s', urlentity.encodeUrl(k)), kid, k)
    );
    e.emit(true, function (failed) {
      if (failed) {
        //failed...
        log._logR('Main::Failed', process.pid);
      } else {
        log._logR('Main::finished', process.pid, 'Toggle to next.');
      }
      //just goto next.
      callback(null);
    });
  }
  log.processID = process.pid;
  process.on('message', function (msg) {
    if (msg.keys) {
      //ready for keys.
      proxyvistor.initVisitor(function (limit) {
        if (limit) {
          log._logR('Main::Limit', process.pid);
          onexit();
        } else {
          //go
          var tasks = [];
          keys = msg.keys;
          for (var k in keys) {
            tasks.push(function (callback) {
              main(callback);
            })
          }
          async.waterfall(tasks, function () {
            log._logR('Main::Done', process.pid);
          });
        }
      });
    }
  });
}
