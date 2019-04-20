#!/bin/bash

NOW=`date +%Y%m%d%H%M%S`
FILENAME=$NOW.mp4

gst-launch-1.0 -e -v udpsrc port=8004 caps="application/x-rtp" ! rtph264depay ! h264parse ! mp4mux ! filesink location=/home/pi/images/$FILENAME
