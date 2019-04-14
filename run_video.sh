#!/bin/bash

set -e
function cleanup {
    echo "Stopping gstreamer..."
    sudo pkill gst-launch-1.0
}

trap cleanup EXIT

gst-launch-1.0 -v rpicamsrc bitrate=1000000 vflip=true metering-mode=3 inline-headers=TRUE keyframe-interval=1 preview=0 ! video/x-h264,width=1280,height=720,framerate=20/1,profile=baseline ! h264parse ! rtph264pay config-interval=1 pt=96 ! udpsink host=127.0.0.1 port=8004
