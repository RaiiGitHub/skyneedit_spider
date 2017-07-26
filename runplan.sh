#/bin/bash
echo "will run the fetching program(tianyc.node.js)..."
cd /data/tianyc
#!/bin/sh
TYC=`ps -fe|grep tianyc |grep -v grep|wc -l|awk '{print $1}'`
echo $TYC
if (($TYC < 31))
then
    echo "clean processes....."
	PROCESS=`ps -ef|grep main_tianyc|grep -v grep|grep -v PPID|awk '{ print $2}'`
    for i in $PROCESS
    do
        echo "Kill the $1 process [ $i ]"
        kill -9 $i
    done
    echo "clean proxy....."
    node main_releaseproxy.js
fi
echo "start main_tianyc.js in 30 process....."
#####
node main.js 30
