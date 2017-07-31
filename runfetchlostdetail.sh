#/bin/bash
echo "will run the fetching program(tianyc.lostdetail.node.js)..."
cd /data/tianyc
#!/bin/sh
PROCESSLIMIT=$1
TYC=`ps -fe|grep main_tianyc_detail_only |grep -v grep|wc -l|awk '{print $1}'`
((TYC--))
echo $TYC
if (($TYC < 2))
then
    echo "clean processes....."
	PROCESS=`ps -ef|grep main_tianyc_detail_only|grep -v grep|grep -v PPID|awk '{ print $2}'`
    for i in $PROCESS
    do
        echo "Kill the main_tianyc_detail_only process [ $i ]"
        kill -9 $i
    done
    echo "clean proxy....."
    node main_releaseproxy.js proxycache_d
    node main_tianyc_detail_only.js $PROCESSLIMIT $2
fi
echo "start main_tianyc_detail_only.js in $PROCESSLIMIT proxies....."
#####
