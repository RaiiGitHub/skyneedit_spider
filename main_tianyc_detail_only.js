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
  });
}

log.init('./datas/logs/detail', 'NORMAL', 'Windows', 'TYCDetailFetcher');
if (cluster.isMaster) {
  process.on('SIGINT', function () {
    onexit();
  });
  var process_args = process.argv.splice(2);
  if (1 > process_args.length) {
    log._logR('Main::EntryPoint', 'argument seperate num should be here.');
    return;
  }
  var sep = parseInt(process_args[0]);
  var db = new dbop();
  db.config();
  db.getCompanyMaxID(function (id) {
    log._logR('Main::Assign',id);
    if (id) {
      var i = 1;
      for (;;) {
        var upb = Math.min(id, i + sep);
        var condition = printf('id >= %s and id <= %s', i, upb);
        log._logR('Main::Assign', 'From', i, 'To', upb);
        var wp = cluster.fork();//work process.
        wp.send({ condition: condition });
        i = upb + 1;
        if (upb == id) {
          break;
        }
      }
    }
  });

} else {
  var db = new dbop;
  var proxy = new pv;
  var concurrency_num = 0;
  db.config();
  process.on('message', function (msg) {
    if (msg.condition) {
      concurrency_num++;
      var e = new emitter(
        db,
        proxy,
        new explainer(msg.condition,null),
        new urlentity('', 1, '')//get fetching urls from db.
      );
      e.emit(true, function (failed) {
        if (failed) {
          //failed...
          log._logR('Main::Failed', process.pid, 'Bye.');
        } else {
          log._logR('Main::finished', process.pid,'rest is',concurrency_num);
        }
        concurrency_num--;
        if( concurrency_num <= 0 )
          onexit();
      });
    }
  });
}

