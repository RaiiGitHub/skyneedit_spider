const printf = require('printf');
const fs = require('fs');
const urlentity = require('./libs/urlentity');
const explainer = require('./logic/tyc_explainer');
const pv = require('./libs/proxyvisitor');
const dbop = require('./logic/tyc_dboperator');
const emitter = require('./libs/searchemitter');
const log = require('./libs/log');
const lr = require('line-reader');
const cluster = require('cluster');
const async = require('async');

log.init('./datas/logs', 'NORMAL', 'Windows', 'TYCFetcher');

if (cluster.isMaster) {
  process.on('SIGINT', function () {
    exit = true;
    log._logR('Main::Exit', 'Got SIGINT.  Release all proxies before exiting...');
    pv.releaseAllProxies(function () {
      log._logR('Main::Exit', 'Bye.');
      process.exit(0);
    });
  });
  var process_args = process.argv.splice(2);
  if (2 > process_args.length) {
    log._logR('Main::EntryPoint', 'argument code and process-num should be here.');
    log._logE('Main::EntryPoint', 'argument code and process-num should be here.');
    return;
  }
  var search_code = process_args[0];
  var process_num = process_args[1];
  //var numCPUs = require('os').cpus().length;
  var worker_tasks = process_num;
  for (var i = 0; i < process_num; i++) {
    var wp = cluster.fork();
    wp.on('message', function (msg) {
      if (msg.onefinished) {
        worker_tasks--;
        if (0 >= worker_tasks) {
          log._logR('Main::Finished', 'all.');
          process.exit(0);
        }
      }
    });
    wp.send({ search_code: search_code });
  }
} else {
  process.on('message', function (msg) {
    var main = null;
    log._logR('Main::SearchKey', msg.search_code);
    var db = new dbop();
    db.config();
    var tasks = [];
    var skeys = [];
    var next_func = function (cb) {
      if (skeys.length == 0) {
        cb(null);
        main();
      } else {
        var k = skeys.splice(0, 1)[0];
        console.log(k);
        var e = new emitter(
          new explainer,
          new dbop,
          new urlentity(printf('http://www.tianyancha.com/search?key=%s', urlentity.encodeUrl(k)), 1, k)
        );
        e.emit(true, function () {
          log._logR('Main::finished', 'one.');
          if (skeys.length == 0) {
            //redo again.
            log._logR('Main::Continue', 'one more time...');
            main();
            cb(null);
          } else {
            cb(null);
          }
        });
      }
    };
    var main = function (cb_main) {
      db.getSearchTaskUnitToRun(msg.search_code, function (runitem) {
        if (runitem) {
          db.updateSearchTaskStatus(runitem.id, 'running', function (ok) {
            if (ok) {
              log._logR('Main::Run', msg.search_code, 'Ready to run,from', runitem.from, 'to', runitem.to);
              task_size = runitem.to - runitem.from + 1;
              db.getSearchKeys(runitem.from, runitem.to, function (keys) {
                if (keys) {
                  for (var k in keys) {
                    skeys.push(keys[k].searchKey);
                    tasks.push(function (callback) {
                      next_func(callback);
                    });
                  }
                  async.waterfall(tasks, function (error, result) {
                  });
                }
              });
            } else {
              log._logR('Main::Run', 'task not found.', msg.search_code);
              log._logE('Main::Run', 'task not found.', msg.search_code);
              process.send({ onefinished: true });
            }
          });
        } else {
          log._logR('Main::Run', 'No data to run', msg.search_code);
          log._logE('Main::Run', 'No data to run', msg.search_code);
          process.send({ onefinished: true });
        }
      });
    }
    main();
  });
} 
