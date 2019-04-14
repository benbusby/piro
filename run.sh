#!/bin/bash

network_ip=(`hostname -I`)

if [[ $# -eq 0 ]]; then
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

    python routes.py ${network_ip[0]}
elif [[ $1 == "remote" ]]; then
    sudo -u pi -H bash -c "/opt/janus/bin/janus --debug-level=7 -F /home/nvidia/JetsonStreaming/janus_conf &"
    sudo -u pi -H bash -c ". /home/nvidia/JetsonStreaming/streaming/venv/bin/activate; python /home/nvidia/JetsonStreaming/streaming/routes.py ${network_ip[0]} &"
else
    echo "Invalid argument provided."
    exit 1
fi
