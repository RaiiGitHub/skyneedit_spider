"use strict";
//a base explainer class
const async = require('async');
class MethodBase{
    constructor(type,explainer){
        this.explainer_ = explainer;
        this.user_data_ = null;//to store the user data.
        this.type_ = type;//normal,finale
        this.pre_ = null;//to form a double-link list,pre method.
        this.next_ = null;//to form a double-link list,pre method.
    }
    finish(callback) {
        if (0 <= this.type_.indexOf('final')) {
            this.explainer_.emitter_.porxy_vistor_.releaseVisitor();
            if( this.explainer_.emitter_.notify_done_ )
                this.explainer_.emitter_.notify_done_();
        }
        callback(null);
    }
    execute(callback){
        //need to be overwritten
        //method's body.
        //callback is a async function object.
        callback(null);
    }
};

class ExplainerBase{
    constructor(){
        this.memo_ = 'explainer';
        this.methods_ = [];//methods are MethodBase list.
        this.emitter_ = null;
        this.tmp_task_build_index_ = 0;
    }
    setupMethod(emitter){
        this.methods_ = [];//need to be overwritten in the extends class.
        this.emitter_ = emitter;
    }
    buildMethodDoubleLink(){
        var len = this.methods_.length;
        for(var m = 0; m < len; m++){
            this.methods_[m].pre_ = (0 == m?null:this.methods_[m-1]);
            this.methods_[m].next_ = (len - 1 == m?null:this.methods_[m+1]);
        }
    }
    runAsyncTask(){
        //warning! setup methods before building the async tasks.
        var tasks = [];
        var self = this;
        this.tmp_task_build_index_ = 0;
        for( var m in this.methods_ ){
            tasks.push(function(callback){
                self.methods_[self.tmp_task_build_index_++].execute(callback);
            });
        }
        //run right now!
        console.log('Tasks in Explainer are running...');
        async.waterfall(tasks, function (err, result) {
            //need to be done in the callback funcions.
        });
    }
};

module.exports = { MethodBase,ExplainerBase };