ENV['APP_ENV'] = 'test'

require 'test/unit'
require 'rack/test'
require './app/server.rb'
require './app/models/user.rb'

class ServerTest < Test::Unit::TestCase
  include Rack::Test::Methods

  @@user_db = User.new
  @@user_db.add('test_user', 'password123')

  def app
    Sinatra::Application
  end

  def test_home_redirect
    get '/logout'
    assert last_response.redirect?

    get '/'
    assert last_response.redirect?
  end

  def test_login
    get '/logout'

    get '/login'
    assert last_response.ok?

    login_data = { 'username' => 'test_user', 'password' => 'password123' }
    post('/login', login_data)
    assert last_response.redirect?

    get '/'
    assert last_response.ok?
    assert !last_response.redirect?

    get '/logout'
    assert last_response.redirect?

    get '/'
    assert last_response.redirect?
  end

  def test_bad_login
    get '/logout'

    bad_login = { 'username' => 'invalid', 'password' => 'password123' }
    post('/login', bad_login)
    assert last_response.redirect?

    get '/'
    assert last_response.redirect?
  end
end
