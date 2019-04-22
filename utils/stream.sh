#!/bin/bash

set -e
function cleanup {
    echo "Stopping gstreamer..."
    sudo pkill gst-launch-1.0
}

trap cleanup EXIT

gst-launch-1.0 -v rpicamsrc vflip=true hflip=true preview=false bitrate=3000000 keyframe-interval=10 ! video/x-h264, framerate=20/1 ! h264parse ! rtph264pay config-interval=1 pt=96 ! udpsink host=127.0.0.1 port=8004 
