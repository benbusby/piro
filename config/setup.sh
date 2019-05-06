#!/bin/bash

BC=$'\e[4m'
EC=$'\e[0m'

bold=$(tput bold)
normal=$(tput sgr0)
red='\033[0;31m'
green='\033[0;32m'
nc='\033[0m'

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

set -e

declare -A reqs=([libsrtp2]=0 [libnice]=0)

echo -e "\nChecking for required libs..."

for i in "${!reqs[@]}"
do
    ldconfig -p | grep "${i,,}" >/dev/null 2>&1 && {
        echo -e "${green}${bold}$i already installed!${normal}${nc}"
        reqs[$i]=1
    } || {
        echo -e "${red}${bold}$i is not installed${normal}${nc}"
    }
done

echo -e "${green}${bold}\nInstalling pre-requisites...${normal}${nc}"

# Janus related requirements
sudo apt-get -y install libmicrohttpd-dev libjansson-dev libssl-dev libsrtp-dev libsofia-sip-ua-dev libglib2.0-dev libopus-dev libogg-dev libcurl4-openssl-dev liblua5.2-dev libconfig-dev pkg-config gengetopt libtool automake gtk-doc-tools

# RazTot/Flask requirements
sudo apt-get -y install python3-dev
sudo apt-get -y install pigpio
sudo apt-get -y install python3-venv

# NGINX setup
if [ ! -d "/etc/nginx/" ]; then 
    sudo apt-get -y install nginx
    sudo /etc/init.d/nginx start
    sudo cp nginx_server.conf /etc/nginx/sites-available/default
    sudo /etc/init.d/nginx restart
else
    echo -e "\n${green}${bold}NGINX already set up.\n${normal}${nc}"
fi

# Video streaming requirements
sudo apt-get -y install libgstreamer1.0-0 gstreamer1.0-plugins-base gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly gstreamer1.0-libav gstreamer1.0-doc gstreamer1.0-tools gstreamer1.0-x gstreamer1.0-alsa gstreamer1.0-pulseaudio

# (Recommended) Install OpenSSL 1.1.1
OPENSSL_VERSION=$(openssl version | cut -d ' ' -f 2 | tr -dc '0-9')
if [ $OPENSSL_VERSION -lt 111 ]; then
    echo -e "\n${green}${bold}OpenSSL v1.1.1 is recommended.\n\n${normal}${nc}Current version:"
    openssl version
    echo
    
    read -p "Install OpenSSL v1.1.1? Installation may take a while. (y/n) " response
    response=${response,,}
    if [[ $response =~ ^(yes|y| ) ]]; then
        wget https://www.openssl.org/source/openssl-1.1.1.tar.gz
        tar xvf openssl-1.1.1.tar.gz
        cd openssl-1.1.1
        sudo ./config -Wl,--enable-new-dtags,-rpath,'$(LIBRPATH)'
        sudo make
        sudo make install
        cd ..
        rm -rf openssl-1.1.1*
    fi
fi

# Install libsrtp2
if [ ${reqs[libsrtp2]} -eq 0 ]; then
    echo -e "\n${green}${bold}Installing libsrtp2...\n${normal}${nc}"
    wget https://github.com/cisco/libsrtp/archive/v2.2.0.tar.gz
    tar xvf v2.2.0.tar.gz
    cd libsrtp-2.2.0
    ./configure --prefix=/usr --enable-openssl
    make shared_library && sudo make install
    cd ..
    rm -rf libsrtp-2.2.0/
    rm v2.2.0.tar.gz
fi

# Install libnice
if [ ${reqs[libnice]} -eq 0 ]; then
    echo -e "\n${green}${bold}Installing libnice...\n${normal}${nc}"
    git clone https://gitlab.freedesktop.org/libnice/libnice
    cd libnice
    
    # Raspbian specific fix
    sed -i -e 's/NICE_ADD_FLAG(\[-Wcast-align\])/# NICE_ADD_FLAG(\[-Wcast-align\])/g' ./configure.ac
    sed -i -e 's/NICE_ADD_FLAG(\[-Wno-cast-function-type\])/# NICE_ADD_FLAG(\[-Wno-cast-function-type\])/g' ./configure.ac
    
    ./autogen.sh
    ./configure --prefix=/usr
    make && sudo make install
    cd ../
    rm -rf libnice/
fi

# Install Janus Gateway
if [ ! -d "/opt/janus/" ]; then 
    echo -e "${green}${bold}Installing Janus Gateway...${normal}${nc}"
    git clone https://github.com/meetecho/janus-gateway.git
    cd janus-gateway
    sh autogen.sh
    ./configure --prefix=/opt/janus
    make
    sudo make install
    sudo make configs
    cd ..
    rm -rf janus-gateway
    sudo cp $SCRIPT_DIR/janus.plugin.streaming.jcfg /opt/janus/etc/janus/
else
    echo -e "\n${green}${bold}Janus Gateway already installed.\n${normal}${nc}--- Streaming configurations are located in /opt/janus/etc/janus/"
fi


# Set up virtual environment
if [ ! -d "$SCRIPT_DIR/../venv" ]; then
    echo -e "${green}${bold}\nSetting up python virtual environment...${normal}${nc}"
    python3 -m venv $SCRIPT_DIR/../venv
fi

# Install all python requirements
echo -e "${green}${bold}\nInstalling required python libraries...${normal}${nc}"
$SCRIPT_DIR/../venv/bin/pip3 install -r requirements.txt

# Setting up user account
echo -e "${green}${bold}\nCreating flask database...${normal}${nc}"
cd $SCRIPT_DIR/..
flask db init
flask db migrate -m "users table"
flask db upgrade
cd $SCRIPT_DIR

while true; do
    read -p "Create your user account now? This can be done later via utils/mod_users.py, but at least one account is required for the RazTot to be functional. (y/n) " yn
    case $yn in
        [Yy]* )
            read -p "Username: " username
            read -p -s "Password: " password
            read -p -s "Confirm Password: " confirm_password
            if [ "$password" == "$confirm_password" ]; then
                python3 $SCRIPT_DIR/../utils/mod_users.py $username $password
                break
            else
                echo -e "${red}${bold}Passwords did not match!!!\n${normal}${nc}"
            fi
            ;;
        [Nn]* )
            echo ""
            break
            ;;
    esac
done

while true; do
    read -p "Create an account with Dataplicity? This will allow you to access the RazTot via a static https url without having to modify your home router settings. There are other services available, but this script will only walk you through setting up a Dataplicity account. (y/n) " yn
    case $yn in
        [Yy]* )
            echo -e "\n${green}${bold}Setting up Dataplicity...${normal}${nc}"
            echo -e "\nIn a browser, navigate to https://dataplicity.com and enter your email in the presented prompt."
            read -p "Paste or type the resulting command here (double-check that it is correct): " dataplicity_command
            $dataplicity_command
            read -p "\n\nNavigate to https://dataplicity.com and verify that your device shows up in your list of devices. If so, click on your device and you should see a command line prompt with a navigation bar on the right. In the nav bar, there's a toggle for enabling Wormhole. Once you have that enabled, press enter to continue.\n\n(Press Enter)"
            read -p "Paste the url displayed below the Wormhole toggle here: " dataplicity_url
            while [[ $dataplicity_url != *"https://"* ]]; do
                echo -e "${red}${bold}The url should contain https:// at the front. Please try again.${normal}${nc}"
                read -p "Paste the url here: " dataplicity_url
            done
            echo $dataplicity_url >> $SCRIPT_DIR/../app/raztot_url
            echo -e "\n${green}${bold}Dataplicity setup complete.${normal}${nc}"
            ;;
        [Nn]* )
            echo ""
            break
            ;;

echo -e "${green}${bold}\nCompleted RazTot setup.\n${normal}${nc}"

echo "################################################################"
echo "# NEXT STEPS                                                   #"
echo "################################################################"
echo ""
echo "Activate the python virtual environment:"
echo -e "${bold}. venv/bin/activate${normal}"
echo ""
echo "Launch the web app:"
echo -e "${bold}./run.sh${normal} or ${bold}./run.sh remote${normal}"
echo ""
