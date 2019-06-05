#!/bin/bash

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

if [[ $# -eq 0 ]] || [[ $1 == "remote" ]] || [[  $1 == "local" ]]; then
    # Optionally run janus (can be skipped if not testing streaming)
    while true; do
        read -p "Run Janus Gateway? (y/n) " yn
        case $yn in
            [Yy]* )
                sudo pkill janus
                sleep 0.5
                echo "Using api key: $RANDOM_KEY"
                sudo /opt/janus/bin/janus -a $RANDOM_KEY &#-d 7 -f &
                break
                ;;
            [Nn]* )
                echo ""
                break
                ;;
        esac
    done
    
    # Start flask server either on local network or public
    if [[ $# -eq 0 ]]; then
        export FLASK_HOST=${NETWORK_IP[0]}
    elif [[ $1 == "local" ]]; then
	    export FLASK_HOST="127.0.0.1"
    elif [[ $1 == "remote" ]]; then
        export FLASK_HOST="0.0.0.0"
    else
        echo "Invalid argument provided."
        exit 1
    fi

    python server.py
elif [[ $1 == "service" ]]; then
    # Start up all necessary services if executing as a systemd service
    sudo pkill janus
    sleep 0.5
    sudo /opt/janus/bin/janus -a $RANDOM_KEY &
    export FLASK_HOST="127.0.0.1"
    su pi
    python server.py
else
    echo "Invalid argument provided."
    exit 1
fi
