#!/bin/bash

BC=$'\e[4m'
EC=$'\e[0m'

bold=$(tput bold)
normal=$(tput sgr0)
red='\033[0;31m'
green='\033[0;32m'
nc='\033[0m'

set -e

declare -A reqs=([libsrtp2]=0 [libnice]=0)

echo -e "${green}${bold}\nChecking for required libs...${normal}${nc}"

for i in "${!reqs[@]}"
do
    ldconfig -p | grep "${i,,}" >/dev/null 2>&1 && {
        echo -e "${green}${bold}$i is installed!${normal}${nc}
        reqs[$i]=1
    } || {
        echo -e "${red}${bold}$i is not installed!${normal}${nc}"
    }
done

echo -e "${green}${bold}\nInstalling pre-requisites...${normal}${nc}"

sudo apt-get -y install libmicrohttpd-dev libjansson-dev libssl-dev libsrtp-dev libsofia-sip-ua-dev libglib2.0-dev libopus-dev libogg-dev libcurl4-openssl-dev liblua5.2-dev libconfig-dev pkg-config gengetopt libtool automake gtk-doc-tools
sudo apt-get -y install python-dev
sudo apt-get -y install pigpio
sudo apt-get -y install virtualenv
sudo apt-get -y install apache2 libapache2-mod-wsgi

sudo apt-get -y install libgstreamer1.0-0 gstreamer1.0-plugins-base gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly gstreamer1.0-libav gstreamer1.0-doc gstreamer1.0-tools gstreamer1.0-x gstreamer1.0-alsa gstreamer1.0-gl gstreamer1.0-gtk3 gstreamer1.0-qt5 gstreamer1.0-pulseaudio

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
    sudo cp ./janus.plugin.streaming.jcfg /opt/janus/etc/janus/
else
    echo -e "\n${green}${bold}Janus Gateway already installed.\n${normal}${nc}--- Streaming configurations are located in /opt/janus/etc/janus/"
fi


# Install virtualenv
if [ ! -d "venv" ]; then
    echo -e "${green}${bold}\nSetting up python virtual environment...${normal}${nc}"
    virtualenv --python=/usr/bin/python2 venv
fi

# Install all python requirements
echo -e "${green}${bold}\nInstalling required python libraries...${normal}${nc}"
./venv/bin/pip install -r requirements.txt

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
