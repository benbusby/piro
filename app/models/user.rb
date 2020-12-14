require 'bcrypt'
require 'sqlite3'

module UserFields
  USERNAME = 'username'
  PW_HASH = 'pw_hash'
  UUID = 'uuid'
end

def gen_hash(text)
  BCrypt::Password.create(text).to_s
end

def check_hash(password, hash)
  BCrypt::Password.new(hash) == password
end

class User
  @user_db = nil

  def initialize(path = __dir__ + '/../user.db')
    puts path
    @user_db = SQLite3::Database.new path
    @user_db.results_as_hash = true
    @user_db.execute <<-SQL
      create table if not exists users (
        uuid varchar(30),
        username varchar(30),
        pw_hash varchar(30)
      );
    SQL
  end

  def get_users
    stm = @user_db.prepare "select * from users"
    stm.execute
  end

  def get_usernames
    stm = @user_db.prepare "select username from users"
    stm.execute
  end

  def get_user(field, value)
    if field.equal? UserFields::USERNAME
      rs = @user_db.execute("select * from users where username=?", [value])
    elsif field.equal? UserFields::UUID
      rs = @user_db.execute("select * from users where uuid=?", [value])
    else
      nil
    end

    if rs.length() == 1
      rs[0]
    end
  end

  def add(username, password)
    if get_user(UserFields::USERNAME, username) == nil
      @user_db.execute("insert into users (uuid, username, pw_hash)
                       values (?, ?, ?)", 
                       [SecureRandom.hex, username, gen_hash(password)])
    end
  end

  def delete(username)
    stm = @user_db.prepare "delete from users where username=?"
    stm.bind_param 1, username
    stm.execute
  end

  def check_user_password(username, password)
    user = get_user(UserFields::USERNAME, username)
    check_hash(password, user['pw_hash'])
  end

  def get_id(username, password)
    user = get_user(UserFields::USERNAME, username)
    if user != nil and check_hash(password, user['pw_hash'])
      user['uuid']
    end
  end

  def valid(session)
    if session
      rs = @user_db.execute("select uuid from users where uuid=?", session)
      if rs.length == 1
        rs[0]
      end
    else
      false
    end
  end
end
