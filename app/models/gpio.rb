require 'rpi_gpio'

module SERVO_PINS
  LEFT = 17
  RIGHT = 22
end

# Assuming mirrored setup of the two servos, one needs to turn
# the opposite direction of the other in order to move forward
# and backward.
#
# CW -> clockwise, CCW -> counter-clockwise
module PWM_VALUES
  CW = 2000
  CCW = 1000
  OFF = 0
end

class InterfaceGPIO
  def initialize
    RPi::GPIO.setup [SERVO_PINS::LEFT, SERVO_PINS::RIGHT], :as => :output
    @pwm_l = RPi::GPIO::PWM.new(SERVO_PINS::LEFT, 0)
    @pwm_r = RPi::GPIO::PWM.new(SERVO_PINS::RIGHT, 0)
  end

  def command(data)
    if data == nil
      move(PWM_VALUES::OFF, PWM_VALUES::OFF)
    elsif data["left"] || data["right"]
      move(data["left"] * PWM_VALUES::CCW,
           data["right"] * PWM_VALUES::CW)
    else
      move(data["down"] ? PWM_VALUES::CCW : PWM_VALUES::CW,
           data["down"] ? PWM_VALUES::CW : PWM_VALUES::CCW)
    end
  end

  def move(left, right)
    @pwm_l.frequency, @pwm_r.frequency = left, right
  end
end
