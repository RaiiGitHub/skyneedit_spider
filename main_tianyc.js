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
  if (1 > process_args.length) {
    log._logR('Main::EntryPoint', 'argument code should be here.');
    log._logE('Main::EntryPoint', 'argument code should be here.');
    return;
  }

  var search_key_index_offset = 1;
  fs.readFile('./sko.txt', 'utf8', function (err, buf) {
    if (!err) {
      var process_num = process_args[0];
      search_key_index_offset = parseInt(buf, 10);
      search_key_index_offset -= process_num;
      search_key_index_offset = Math.max(0, search_key_index_offset);
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
          } else if (msg.next) {
            search_key_index_offset++;
            fs.writeFile('./sko.txt', search_key_index_offset, function (err) {
              console.log('Main::Next', wp_.id,wp_.process.pid,'Ready to go to the next,next is',search_key_index_offset);
              wp_.send({ offset: search_key_index_offset });
            });
          }
        });
        wp.send({ begin: true });
      }
    }
  })
} else {
  process.on('message', function (msg) {
    if (msg.begin) {
      process.send({ next: true });
    }
    else if (msg.offset) {
      log.processID = process.pid;
      log._logR('Main::Log',log.processID,'Ready to log...');
      var db = new dbop();
      db.config();
      db.getSearchKeys(msg.offset, 1, function (results) {
        if (results) {
          var k = results[0].searchKey;
          var e = new emitter(
            new explainer,
            new dbop,
            new urlentity(printf('http://www.tianyancha.com/search?key=%s', urlentity.encodeUrl(k)), 1, k)
          );
          e.emit(true, function (failed) {
            if (failed) {
              //failed...
              log._logR('Main::Failed', process.pid, 'Bye.');
              process.send({ nomoredata: true });
            } else {
              log._logR('Main::finished', process.pid, 'Toggle to next.');
              process.send({ next: true });
            }
          });
        } else {
          process.send({ nomoredata: true });//no more datas.
        }
      });
    }
  });
} 
