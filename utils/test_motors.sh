#!/bin/bash

if ! pgrep -x "pigpiod" > /dev/null
then
    echo "Starting pigpiod..."
    sudo pigpiod
fi

if [ "$#" -ne 2 ]; then
    echo -e "\nUsage: ./test_motors.sh <motor #1 pin> <motor #2 pin>"
    echo -e "Example (for motors on pins 17 and 27): ./test_motors.sh 17 27\n"
    exit 0
fi

echo -e "\nMotor #1 test (slow)..."
sleep 0.5
pigs m $1 w servo $1 1600 mils 1000 servo $1 0

echo -e "\nMotor #2 test (slow)..."
sleep 0.5
pigs m $2 w servo $2 1600 mils 1000 servo $2 0

echo -e "\nBoth motors (slow)..."
sleep 0.5
pigs m $1 w m $2 w servo $1 1600 servo $2 1300 mils 1000 servo $1 0 servo $2 0

echo -e "\nBoth motors (fast)..."
sleep 0.5
pigs m $1 w m $2 w servo $1 2300 servo $2 700 mils 1000 servo $1 0 servo $2 0
