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
process.on('SIGINT', function () {
  exit = true;
  log._logR('Main::Exit', 'Got SIGINT.  Release all proxies before exiting...');
  pv.releaseAllProxies(function () {
    log._logR('Main::Exit', 'Bye.');
    process.exit(0);
  });
});
db = new dbop;
db.config();
setTimeout(function () {
  var tasks = [];
  var skeys = [];
  var next_func = function (cb) {
    if (skeys.length == 0) {
      cb(null);
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
      });
      cb(null);
    }
  };

  db.getSearchKeys(1, 1000, function (keys) {
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
}, 1000);

// if (cluster.isMaster) {
//   var exit = false;
//   process.on('SIGINT', function () {
//     exit = true;
//     log._logR('Main::Exit', 'Got SIGINT.  Release all proxies before exiting...');
//     pv.releaseAllProxies(function () {
//       log._logR('Main::Exit', 'Bye.');
//       process.exit(0);
//     });
//   });
//   var worker_tasks = 0;
//   var numCPUs = require('os').cpus().length;
//   for (var i = 0; i < numCPUs; i++) {
//     var wp = cluster.fork();
//     wp.on('message', function (msg) {
//       if (msg.onefinished) {
//         worker_tasks--;
//         if (0 >= worker_tasks) {
//           log._logR('Main::Finished', 'all.');
//           process.exit(0);
//         }
//       }
//     });
//   }
//   var line_index = 0;
//   lr.eachLine('./datas/searchkey/1.txt', function (line, last) {
//     if (exit) {
//       return false;
//     } else {
//       var pi = line_index % numCPUs;
//       //console.log(line_index, 'Put line to process[', pi, ']===>', line);
//       cluster.workers[pi + 1].send({ content: line.match(/(\d+)---(\S*)/)[2], end: last });
//       worker_tasks++;
//       log._logR('Main::tasks', worker_tasks);
//       //for test.
//       // if (line_index > 1)
//       //   last = true;
//       if (last) {
//         log._logR('Main::mission', 'dispatched.');
//         //return false;
//       }
//       line_index++;
//     }
//   });

// } else {
//   process.on('message', function (msg) {
//     if (msg.content) {
//       //console.log(process.pid,'mission recieved===>',msg.content);
//       log._logR('Main::search', process.pid, msg.content);
//       var e = new emitter(
//         new explainer,
//         new dbop,
//         new urlentity(printf('http://www.tianyancha.com/search?key=%s', urlentity.encodeUrl(msg.content)), 1, msg.content)
//       );
//       e.dboperator_.ensureTablesExist(function () {
//         e.emit(true, function () {
//           log._logR('Main::finished', 'one.');
//           process.send({ onefinished: true });
//         });
//       });
//     }
//   });
// } 
