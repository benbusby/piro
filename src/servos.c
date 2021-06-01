#include <stdlib.h>
#include <pigpio.h>

#define CW   1000
#define CCW  2000
#define STOP 0

void drive(int l, int r) {
    if (gpioInitialise() >= 0) {
        gpioServo(atoi(getenv("SERVO_L")), l ? CW : STOP);
        gpioServo(atoi(getenv("SERVO_R")), r ? CCW : STOP);
    }
}