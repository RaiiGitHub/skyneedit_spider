// const fs = require('fs');
// console.log('hello,world!',Date());
// fs.writeFile('./datas/logs/test.txt','hello,how are you?',function(err){

// });

// var Semaphore = require("node-semaphore");
// var pool = Semaphore(5);
// for (var i = 0; i < 250; i++) {
//     pool.acquire(function (){ 
//         console.log("Running...",i);
//          //pool.release();
//     });
// }
var tape = require('tape')
var should = require('should');
var lock = require('lock')();
function test(what) {
    console.log('test...',what);
}

// //tape('lock with optional done', function (t) {

// lock('what?', function (release) {
//     console.log('tick 1.releasing lock.', lock.isLocked('what?'));
//     // process.nextTick(release(function () {
//     //     console.log('tick 2.released lock.', lock.isLocked('what?'));
//     //     //t.equal(lock.isLocked(), false);
//     // }));
//     setTimeout(release(function(){
//         console.log('tick 2.released lock.', lock.isLocked('what?'));
//     }), 5*1000);
// })
// console.log('tick 3.building lock..', lock.isLocked('what?'))
// lock('what?', function (release) {
//     console.log('tick 4.on release,but lock again...', lock.isLocked('what?'));
//     //t.equal(lock.isLocked(), true, 'locked!');
//     process.nextTick(
//     release(function () {
//         console.log('tick 5.release final....', lock.isLocked('what?'));
//         process.nextTick(test,'goodbye!');
//     }));
// })

// console.log('tick 6.building lock..', lock.isLocked('what?'))
//})

// lock('proxy',function(release){
//     console.log('lock',lock.isLocked('proxy'));
//     release(function(){
//         console.log('released');
//     });
// })
var reqeust = require('request');
var t = 1;
for(var i = 0; i < 1000; i++){
    reqeust.get('https://www.baidu.com',function(e,r,b){
        for(var j = 0; j < 5000; j++ ){console.log(j)}
        console.log('================get================>',t++);
        if( t == 2)
            process.nextTick(function(){
                console.log('-------------------nextTick-------------');
                for( var k = 0; k < 5000;k++){console.log('::nextTick',k)}
            })
    })
}
