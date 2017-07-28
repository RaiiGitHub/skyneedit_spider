#/bin/bash
echo "will run the fetching program(tianyc.node.js)..."
cd /data/tianyc
#!/bin/sh
PROCESSLIMIT=$1
IPLIMIT=$2
TYC=`ps -fe|grep main_tianyc |grep -v grep|wc -l|awk '{print $1}'`
((TYC--))
echo $TYC
if (($TYC < $PROCESSLIMIT))
then
    echo "clean processes....."
	PROCESS=`ps -ef|grep main_tianyc|grep -v grep|grep -v PPID|awk '{ print $2}'`
    for i in $PROCESS
    do
        echo "Kill the main_tianyc process [ $i ]"
        kill -9 $i
    done
    echo "clean proxy....."
    node main_releaseproxy.js
    node main_tianyc.js $PROCESSLIMIT $IPLIMIT
fi
echo "start main_tianyc.js in $PROCESSLIMIT with $IPLIMIT proxies....."
#####
