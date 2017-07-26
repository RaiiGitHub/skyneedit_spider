#/bin/bash
echo "will run the fetching program(tianyc.node.js)..."
cd /data/tianyc
#!/bin/sh
w = `ps -fe|grep tianyc |grep -v grep|wc -l`
echo $w
if (($w < 30))
then
	PROCESS=`ps -ef|grep tianyc|grep -v grep|grep -v PPID|awk '{ print $2}'`
    for i in $PROCESS
    do
        echo "Kill the $1 process [ $i ]"
        kill -9 $i
    done
fi
echo "start main.js in 30 process....."
#####
node main.js 30