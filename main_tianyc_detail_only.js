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
  },'proxycache_d');
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
  var limit = 2 <= process_args.length?parseInt(process_args[1]):null;
  var db = new dbop();
  db.config();
  db.getCompanyMaxID(function (id) {
    var sep = parseInt(id /ws);
    log._logR('Main::Assign',ws,'*',sep);
    if (id) {
      var i = 1;
      for (;;) {
        var upb = Math.min(id, i + sep);
        var condition = printf('id >= %s and id <= %s', i, upb);
        log._logR('Main::Assign', 'From', i, 'To', upb);
        var wp = cluster.fork();//work process.
        wp.send({ condition: condition,limit:limit });
        i = upb + 1;
        if (upb == id) {
          break;
        }
      }
    }
  });

} else {
  var db = new dbop;
  var proxy = new pv('proxycache_d');
  var concurrency_num = 0;
  log.processID = process.pid;
  db.config();
  process.on('message', function (msg) {
    if (msg.condition) {
      concurrency_num++;
      var e = new emitter(
        db,
        proxy,
        concurrency_num,
        new explainer(msg.condition,msg.limit),
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
          e.ensureReleaseProxy();
      });
    }
  });
}

