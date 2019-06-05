#!/bin/bash

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

NOW=`date +%Y-%m-%d-%H_%M_%S`
FILENAME=$NOW.mp4

gst-launch-1.0 -e -v udpsrc port=8005 caps="application/x-rtp" ! rtph264depay ! h264parse ! mp4mux ! filesink location=$SCRIPT_DIR/../app/static/captures/$FILENAME
