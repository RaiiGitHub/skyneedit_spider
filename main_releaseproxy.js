const pv = require('./libs/proxyvisitor');
const log = require('./libs/log');
log.init('./datas/logs', 'NORMAL', 'Windows', 'TYCFetcher');
var process_args = process.argv.splice(2);
var dir = process_args.length > 0 ? process_args[0]:'proxycache';
pv.releaseAllProxies(function () {
  log._logR('Main::Exit', 'Bye.');
  process.exit(0);
},dir);