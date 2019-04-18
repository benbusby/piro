#!/bin/bash

network_ip=(`hostname -I`)

if [[ $# -eq 0 ]] || [[ $1 == "remote" ]]; then
    # Optionally run janus (can be skipped if not testing streaming)
    while true; do
        read -p "Run Janus Gateway? (y/n) " yn
        case $yn in
            [Yy]* )
                sudo /opt/janus/bin/janus &#--debug-level=7 -F ./janus_conf &
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
        python routes.py ${network_ip[0]}
    elif [[ $1 == "remote" ]]; then
        python routes.py # default ip in routes is already 0.0.0.0
elif [[ $1 == "service" ]]; then
    # Start up all necessary services if executing as a systemd service
    sudo -u pi -H bash -c "pigpiod"
    sudo -u pi -H bash -c "/opt/janus/bin/janus &"
    sudo -u pi -H bash -c ". /home/pi/raztot/venv/bin/activate; python /home/pi/raztot/routes.py &"
else
    echo "Invalid argument provided."
    exit 1
fi
