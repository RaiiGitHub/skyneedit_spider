const lr = require('line-reader');
const fs = require('fs');
const printf = require('printf');
process.on('SIGINT', function () {
  console.log('Got SIGINT.  Press Control-D/Control-C to exit.');
  process.exit(0);
});
process.on('uncaughtException', function (err) {
  console.error(err.stack);
  console.log("Node NOT Exiting...");
});

Date.prototype.format = function (fmt) {
  var o = {
    "M+": this.getMonth() + 1,                 //月份 
    "d+": this.getDate(),                    //日 
    "h+": this.getHours(),                   //小时 
    "m+": this.getMinutes(),                 //分 
    "s+": this.getSeconds(),                 //秒 
    "q+": Math.floor((this.getMonth() + 3) / 3), //季度 
    "S": this.getMilliseconds()             //毫秒 
  };
  if (/(y+)/.test(fmt)) {
    fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
  }
  for (var k in o) {
    if (new RegExp("(" + k + ")").test(fmt)) {
      fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    }
  }
  return fmt;
}
var today_log = printf('./datas/logs/%s/', (new Date()).format("yyyy-M-d"));
var total_log = today_log + 'all.log';
console.log('Getting logs of today...', today_log);
fs.unlink(total_log, function (err) {
  if( !!err )
    console.log(err);
  fs.readdir(today_log, function (err, files) {
    if (err) {
      console.log(err);
      return;
    }
    var count = files.length;
    files.forEach(function (filename) {
      fs.readFile(today_log + filename, 'utf8', function (err, body) {
        fs.appendFile(total_log,'========='+filename+'=========\n'+body,'utf8');
      });
    });
  });
})
console.log("done.");
return;