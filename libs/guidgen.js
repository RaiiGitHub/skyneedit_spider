"use strict";
class GuidGenerator {
    static s4() {
        return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    }
    static gen() {
        return (GuidGenerator.s4() 
        + GuidGenerator.s4() 
        + GuidGenerator.s4() 
        + GuidGenerator.s4() 
        + GuidGenerator.s4() 
        + GuidGenerator.s4() 
        + GuidGenerator.s4() 
        + GuidGenerator.s4());
    }
};
module.exports = GuidGenerator;
