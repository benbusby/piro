#!/bin/bash

USAGE=$(cat <<-END
 
    Usage: source run.sh [remote|local] (flags)
    Arguments:
        - remote : Launches the flask app on 0.0.0.0 (public)
        - local  : Launches the flask app on 127.0.0.1 (for use with the included nginx configuration)
    Flags:
        --skip-janus : Skips launching Janus Gateway
                       Note: For debugging only (Janus Gateway is required for video streaming)
 
END
)

if [[ $# -eq 0 ]]; then
    echo -e "$USAGE"
    return
fi

export RANDOM_KEY=`head /dev/urandom | tr -dc A-Za-z0-9 | head -c 32 ; echo ''`
NETWORK_IP=(`hostname -I`)

if ! pgrep -x "pigpiod" > /dev/null
then
    echo "Starting pigpiod..."
    sudo pigpiod
fi

if [[ "$VIRTUAL_ENV" == "" ]]; then
    source venv/bin/activate
fi

# Start flask server either on local network or public
if [[ $1 == "local" ]]; then
    export FLASK_HOST="127.0.0.1"
elif [[ $1 == "remote" ]]; then
    export FLASK_HOST="0.0.0.0"
else
    echo -e "$USAGE"
    return
fi

# Start (or skip) janus gateway for streaming
if [[ $* == *--skip-janus* ]]; then
    echo -e "Skipping Janus..."
else
    sudo pkill janus
    sleep 0.5
    echo "Using api key: $RANDOM_KEY"
    sudo /opt/janus/bin/janus -a $RANDOM_KEY &
fi

python server.py
