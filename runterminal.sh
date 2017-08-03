#/bin/bash
echo "will terminal the fetching program(tianyc.node.js)..."
cd /home/work/tianyc
#!/bin/sh
TYC=`ps -fe|grep main_tianyc |grep -v grep|wc -l|awk '{print $1}'`
echo $TYC
if (($TYC > 0))
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
echo "main_tianyc.js terminaled..."
#####
