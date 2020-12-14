#!/usr/bin/env ruby

require 'securerandom'
require 'sqlite3'
require 'highline'
require './app/models/user.rb'

Signal.trap("INT") { 
  p 'Exiting'
  exit
}

$cli = HighLine.new
$sep = "\n=========================================="

class DatabaseCLI
  def initialize(db_model)
    @db_model = db_model
  end

  def prompt
    puts $sep
    puts "Current users:"
    @db_model.get_users.each_hash do |row|
      p row
    end
    puts "\n"
    $cli.choose do |menu|
      menu.prompt = "Select an action: "
      menu.choice(:create) { create_user }
      menu.choice(:delete) { delete_user }
      menu.choice(:exit) { exit }
    end
  end

  def create_user
    puts "\n-- Create new user --"
    username = $cli.ask('       Username: ')
    password = $cli.ask('       Password: ') { |q| q.echo = '*' }
    password_repeat = $cli.ask('Repeat Password: ') { |q| q.echo = '*' }

    if password != password_repeat
      puts '!!! Passwords do not match'
      create_user
    elsif @db_model.get_user(UserFields::USERNAME, username) != nil
      puts '!!! User already exists'
      create_user
    end

    @db_model.add(username, password)

    prompt
  end

  def delete_user
    puts "\n-- Delete a user --"
    rs = @db_model.get_usernames
    puts "\n"
    username = $cli.choose do |menu|
      menu.prompt = "Choose a user to delete: "
      for row in rs do
        menu.choice(row[0])
      end
    end

    @db_model.delete(username)
    prompt
  end
end

if __FILE__==$0
  user_db = User.new
  db_cli = DatabaseCLI.new(user_db)
  db_cli.prompt
end
