const printf = require('printf');
const fs = require('fs');
const urlentity = require('./libs/urlentity');
const explainer = require('./logic/tyc_explainer');
const pv = require('./libs/proxyvisitor');
const dbop = require('./logic/tyc_dboperator');
const emitter = require('./libs/searchemitter');
const log = require('./libs/log');
const cluster = require('cluster');

log.init('./datas/logs', 'NORMAL', 'Windows', 'TYCFetcher');

if (cluster.isMaster) {
  var search_key_index = 1;
  process.on('SIGINT', function () {
    log._logR('Main::Exit', 'Got SIGINT.  Release all proxies before exiting...');
    pv.releaseAllProxies(function () {
      log._logR('Main::Exit', 'Bye.');
      process.exit(0);
    });
  });
  var process_args = process.argv.splice(2);
  if (2 > process_args.length) {
    log._logR('Main::EntryPoint', 'argument processnum and processconcurrency  should be here.');
    return;
  }
  var search_key_index_offset = 1;
  fs.readFile('./offset.txt', 'utf8', function (err, buf) {
    if (!err) {
      var process_num = process_args[0];
      var process_concurrency = process_args[1];
      search_key_index_offset = parseInt(buf, 10);
      search_key_index_offset -= process_num;
      search_key_index_offset = Math.max(1, search_key_index_offset);
      //var numCPUs = require('os').cpus().length;
      var worker_tasks = process_num;
      for (var i = 0; i < process_num; i++) {
        var wp = cluster.fork();
        wp.on('message', function (msg) {
          var wp_ = this;
          if (msg.nomoredata) {
            worker_tasks--;
            if (0 >= worker_tasks) {
              log._logR('Main::Finished', 'all.');
              process.exit(0);
            }
          } else if (msg.ready) {
            for (var index = 1; index <= process_concurrency; index++) {
              console.log(index);
              wp_.send({ begin: true, index: index, concurrency: process_concurrency });
            }
          } else if (msg.next) {
            fs.writeFile('./offset.txt', search_key_index_offset, function (err) {
              console.log('Main::Next', wp_.id, wp_.process.pid, 'Ready to go to the next,next is', search_key_index_offset);
              wp_.send({ offset: search_key_index_offset++, index: msg.index });
            });
          }
        });
      }
    }
  })
} else {
  var proxyvistor = new pv;
  var db = new dbop();
  var concurrency_num = 0;
  var concurrency_done = 0;
  proxyvistor.initVisitor(function (limit) {
    log.processID = process.pid;
    if (limit) {
      log._logR('Main::Limit', process.pid);
      process.send({ nomoredata: true });
    }else{
      log._logR('Main::Ready', process.pid);
      process.send({ ready: true });
    }
  });
  process.on('message', function (msg) {
    if (msg.begin) {
      process.send({ next: true, index: msg.index });
      if (0 == concurrency_num)
        concurrency_num = msg.concurrency;
    }
    else if (msg.offset) {
      var index = msg.index;
      log._logR('Main::Log', log.processID, 'concurrency:', index, '/', concurrency_num, 'Ready to log...');
      db.getSearchKeys(msg.offset, 1, function (results) {
        if (results) {
          var k = results[0].searchKey;
          var kid = results[0].id;
          var e = new emitter(
            db,
            proxyvistor,
            index,
            new explainer,
            new urlentity(printf('http://www.tianyancha.com/search?key=%s', urlentity.encodeUrl(k)), kid, k)
          );
          e.emit(true, function (failed) {
            if (failed) {
              //failed...
              concurrency_done++;
              log._logR('Main::Failed', process.pid, 'Bye.');
              if (concurrency_done >= concurrency_num) {
                e.ensureReleaseProxy();
                db.connect(false);
                process.send({ nomoredata: true });
              }
            } else {
              log._logR('Main::finished', process.pid, 'Toggle to next.next will be', msg.offset);
              process.send({ next: true,index:index });
            }
          });
        } else {
          log._logR('Main::NomoreData', process.pid);
          if (concurrency_done >= concurrency_num) {
            e.ensureReleaseProxy();
            db.connect(false);
            process.send({ nomoredata: true });//no more datas.
          }
        }
      });
    }
  });
} 
