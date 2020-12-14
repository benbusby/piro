#!/usr/bin/env ruby
# =========================================================
# RazTot Sinatra Server
# =========================================================
# This defines the API for the RazTot server, including
# both HTTP and WebSocket handling. 
#
# It is intentionally kept very minimal, with the bulk of
# its purpose being handling user authentication and 
# forwarding user input to the GPIO pins.
#
# All video streaming is handled separately using Janus
# Gateway.
require "bundler/setup"
require "json"
require "securerandom"
require "sinatra"
require "sinatra-websocket"
require "./app/models/user.rb"
require "./app/models/psutil.rb"

# We can't rely on GPIO being available in all development
# environments
$servos = nil
begin
  require "./app/models/gpio.rb"
  $servos = InterfaceGPIO.new
rescue LoadError
  puts "Unable to initialize gpio module"
end

$user_db = User.new

set :server, "thin", connections: []
set :sockets, []
set :public_folder, File.dirname(__FILE__) + "/static"
set :bind, ENV["BIND_HOST"] || "127.0.0.1"

configure do
  enable :sessions
  set :session_secret, SecureRandom.alphanumeric
end

# Set up an auth decorator for protecting access to
# video streaming and servo controls
register do
  def auth(type)
    condition do
      redirect to("/login") unless send("is_#{type}?")
    end
  end
end

helpers do
  def is_user?
    @user != nil and $user_db.valid(session[:user_id])
  end
end

before do
  @user = $user_db.get_user(UserFields::UUID, session[:user_id])
end

get "/login" do
  erb :login
end

post "/login" do
  session[:user_id] = $user_db.get_id(params["username"], params["password"])
  if $user_db.valid(session[:user_id])
    redirect to("/")
  end
  redirect to("/login")
end

get "/logout" do
  session[:user_id] = nil
  redirect to("/login")
end

# The / route is responsible for displaying the video streaming
# window and handling user input to the raztot servos.
# Note: This should always have protected access.
get "/", :auth => :user do
  if !request.websocket?
    erb :index
  else
    request.websocket do |ws|
      ws.onopen do
        ws.send("Socket open")
        settings.sockets << ws
      end
      ws.onmessage do |msg|
        cmd = JSON.parse(msg)
        if $servos != nil && cmd.key?("move")
          $servos.command(cmd)
        elsif cmd.key?("status")
          EM.next_tick {
            settings.sockets.each { |s|
              s.send(get_disk_space.to_json)
            }
          }
        end
      end
      ws.onclose do
        warn("websocket closed")
        settings.sockets.delete(ws)
      end
    end
  end
end
