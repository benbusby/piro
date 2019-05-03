#!/bin/bash

export RANDOM_KEY=`head /dev/urandom | tr -dc A-Za-z0-9 | head -c 32 ; echo ''`
NETWORK_IP=(`hostname -I`)

if [[ $# -eq 0 ]] || [[ $1 == "remote" ]]; then
    # Optionally run janus (can be skipped if not testing streaming)
    while true; do
        read -p "Run Janus Gateway? (y/n) " yn
        case $yn in
            [Yy]* )
                echo "Using api key: $RANDOM_KEY"
                sudo /opt/janus/bin/janus -a $RANDOM_KEY &
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
    elif [[ $1 == "remote" ]]; then
        export FLASK_HOST="0.0.0.0"
    else
        echo "Invalid argument provided."
        exit 1
    fi

    python server.py
elif [[ $1 == "service" ]]; then
    # Start up all necessary services if executing as a systemd service
    sudo -u pi -H bash -c "pigpiod"
    sudo -u pi -H bash -c "/opt/janus/bin/janus &"
    sudo -u pi -H bash -c ". /home/pi/raztot/venv/bin/activate; python /home/pi/raztot/server.py &"
else
    echo "Invalid argument provided."
    exit 1
fi
