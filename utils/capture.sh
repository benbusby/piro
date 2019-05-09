#!/bin/bash

set -e

#gst-launch-1.0 -v rpicamsrc vflip=true hflip=true preview=false bitrate=3000000 keyframe-interval=20 ! video/x-h264, framerate=20/1 ! h264parse ! rtph264pay config-interval=1 pt=96 ! udpsink host=127.0.0.1 port=8005 &

NOW=`date +%Y-%m-%d-%H_%M_%S`
FILENAME=$NOW.mp4

gst-launch-1.0 -e -v udpsrc port=8005 caps="application/x-rtp" ! rtph264depay ! h264parse ! mp4mux ! filesink location=/home/pi/raztot/app/static/captures/$FILENAME
