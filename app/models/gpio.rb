require "rpi_gpio"

# Note: Change these if you aren't using pins 17 and 22
module Pins
  LEFT = 17
  RIGHT = 22
end

# Assuming mirrored setup of the two servos, one needs to turn
# the opposite direction of the other in order to move forward
# and backward.
#
# CW -> clockwise, CCW -> counter-clockwise
module PWM
  CW = 2000
  CCW = 1000
  OFF = 0
end

# Interface between the server and GPIO PWM servos
class InterfaceGPIO
  def initialize
    puts "Initializing GPIO interface..."
    RPi::GPIO.setup [Pins::LEFT, Pins::RIGHT], :as => :output
    @pwm_l = RPi::GPIO::PWM.new(Pins::LEFT, 0)
    @pwm_r = RPi::GPIO::PWM.new(Pins::RIGHT, 0)
    puts "GPIO interface ready to use!"
  end

  def move(left, right)
    @pwm_l.frequency, @pwm_r.frequency = left, right
    puts "PWM_L::%d | PWM_R::%d" % [left, right]
  end

  def command(data)
    if data == nil
      move(PWM::OFF, PWM::OFF)
    elsif data[:left] || data[:right]

      move(data[:left] * PWM::CCW,
           data[:right] * PWM::CW)
    elsif data[:up] || data[:down]
      move(data[:down] ? PWM::CCW : PWM::CW,
           data[:down] ? PWM::CW : PWM::CCW)
    end
  end
end

