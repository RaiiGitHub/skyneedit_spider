#/bin/bash
echo "will run the fetching program(tianyc.node.js)..."
echo "May show errors.Just ignore it..."
cd /data/tianyc
#!/bin/sh
ps -fe|grep tianyc |grep -v grep
if [ $? -ne 0 ]
then
    echo "need to start new process....."
else
    echo "already runing....."
fi
#####
node main.js 10