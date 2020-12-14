#!/bin/bash

USAGE=$(cat <<-END
 
    Usage: source run.sh [remote|local] (flags)
    Arguments:
        - remote : Launches the flask app on 0.0.0.0 (public)
        - local  : Launches the flask app on 127.0.0.1 (for use with the included nginx configuration)
    Flags:
        --skip-janus : Skips launching Janus Gateway
                       Note: For debugging only (Janus Gateway is required for video streaming)
        --skip-gpio  : Skips initializing the Pi GPIO daemon
                       Note: Required for controlling the servo motors
 
END
)

declare -A ARGS=([remote]="0.0.0.0" [local]="127.0.0.1")
test "${ARGS[$1]+_}" && export BIND_HOST="${ARGS[$1]}"

if [[ "$(command -v pigpiod)" ]] && [[ $* != *--skip-gpio* ]]; then
    echo "Starting pigpiod..."
    sudo pigpiod
fi

# Start (or skip) janus gateway for streaming
if [[ $* != *--skip-janus* ]]; then
    sudo pkill janus
    sleep 0.5
    echo "Using api key: $RANDOM_KEY"
    sudo /opt/janus/bin/janus -a $RANDOM_KEY &
fi

bundle config set path '.bundle/'
bundle install
bundle exec app/server.rb
