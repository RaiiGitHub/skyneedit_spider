"use strict";
class ContainerBase{
    constructor(){
        this.container_ = [];
    }
    check(ele){
        //need to be overwritten.
        for( var e in this.container_ ){
            if( ele == this.container_[e])
                return true;
        }
        return false;
    }
    size(){
        return this.container_.length;
    }
    add(ele){
        var c = (null != arguments[1]) ? arguments[1] : true;
        if( c && this.check(ele) )
            return false;
        this.container_.push(ele);
        return true;
    }
    remove(index){
        if( 0 < this.container_.length ){
            return this.container_.splice(index, 1)[0];
        }
        return null;
    }
    insert(ele,index){
        if( (arguments[2] ? arguments[2] : true) 
            && this.check(ele) )
            return false;
        this.container_.splice(index,0,ele);
    }
    popBack(){
        if( 0 < this.container_.length ){
            return this.container_.pop();
        }
        return null;
    }
    popFront(){
        if( 0 < this.container_.length ){
            return this.container_.splice(0, 1)[0];
        }
        return null;
    }
    back(){
        var len = this.container_.length;
        if( 0 < len ){
            return this.container_[len-1];
        }
        return null;
    }
    front(){
        var len = this.container_.length;
        if( 0 < len ){
            return this.container_[0];
        }
        return null;
    }
    empty(){
        return 0 == this.container_.length;
    }
};
module.exports = ContainerBase;
