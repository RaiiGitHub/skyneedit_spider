const printf = require('printf');
const fs = require('fs');
const urlentity = require('./libs/urlentity');
const explainer = require('./logic/tyc_explainer_detial_only');
const pv = require('./libs/proxyvisitor');
const dbop = require('./logic/tyc_dboperator');
const emitter = require('./libs/searchemitter');
const log = require('./libs/log');
const cluster = require('cluster');

function onexit() {
  log._logR('Main::Exit', 'Got SIGINT.  Release all proxies before exiting...');
  pv.releaseAllProxies(function () {
    log._logR('Main::Exit', 'Bye.');
    process.exit(0);
  }, 'proxycache_d');
}

log.init('./datas/logs/detail', 'NORMAL', 'Windows', 'TYCDetailFetcher');
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
  var limit = 2 <= process_args.length ? parseInt(process_args[1]) : null;
  var db = new dbop();
  db.getNoDetailPageUrls(function (results) {
    var ave = parseInt(results.length / ws);
    var index = 0;
    db.end();
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
      wp.send({ keys: keys });
    }
  }, limit);

} else {
  var db = new dbop;
  var proxy = new pv('proxycache_d');
  var concurrency_num = 0;
  log.processID = process.pid;
  process.on('message', function (msg) {
    if (msg.keys) {
      concurrency_num++;
      var e = new emitter(
        db,
        proxy,
        concurrency_num,
        new explainer(msg.keys),
        new urlentity('', 1, '')//get fetching urls from db.
      );
      e.emit(true, function (failed) {
        db.end();
        if (failed) {
          //failed...
          log._logR('Main::Failed', process.pid, 'Bye.');
        } else {
          log._logR('Main::finished', process.pid, 'rest is', concurrency_num);
        }
        concurrency_num--;
        if (concurrency_num <= 0) {
          e.ensureReleaseProxy();
        }
      });
    }
  });
}

