const pv = require('./libs/proxyvisitor');
const log = require('./libs/log');
log.init('./datas/logs', 'NORMAL', 'Windows', 'TYCFetcher');
pv.releaseAllProxies(function () {
    log._logR('Main::Exit', 'Bye.');
    process.exit(0);
  });