#!/bin/bash

BC=$'\e[4m'
EC=$'\e[0m'

bold=$(tput bold)
ital=$(tput sitm)
normal=$(tput sgr0)
red='\033[0;31m'
green='\033[0;32m'
ltcyan='\033[0;96m'
nc='\033[0m'

if [ ! -d "venv" ]; then
    echo -e "${green}${bold}\nSetting up python virtual environment...${normal}${nc}"
    python3 -m venv venv
fi

echo -e "${green}${bold}\nInstalling requirements via pip...${normal}${nc}"
./venv/bin/pip install -r requirements.txt

echo -e "${green}${bold}\nCompleted flask app setup.\n${normal}${nc}"

echo "################################################################"
echo "# NEXT STEPS                                                   #"
echo "################################################################"
echo ""
echo "Activate the python virtual environment:"
echo -e "${ltcyan}${bold}. venv/bin/activate${normal}${nc}"
echo ""
echo "Launch the web app:"
echo -e "${ltcyan}${bold}./run_server.sh${normal}${nc} or ${ltcyan}${bold}./run_server.sh remote${normal}${nc}"
echo ""
