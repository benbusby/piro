require "minitest/autorun"
require "minitest/pride"
require "./app/models/user.rb"

$test_db_path = __dir__ + "/../user_test.db"

class UserDBTest < Minitest::Test
  if File.file?($test_db_path)
    File.open($test_db_path) do |f|
      File.delete(f)
    end
  end

  @@user_db = User.new($test_db_path)
  @@test_group = ["user_a", "user_b", "user_c"]
  @@test_group.each do |user|
    @@user_db.delete(user)
  end

  def test_init
    assert File.file?($test_db_path)
    assert @@user_db
  end

  def test_add_delete
    @@user_db.add(@@test_group[0], "password123")
    assert @@user_db.get_user(UserFields::USERNAME, @@test_group[0])

    @@user_db.delete(@@test_group[0])
    assert !@@user_db.get_user(UserFields::USERNAME, @@test_group[0])
  end

  def test_get
    @@test_group.each do |user|
      @@user_db.add(user, "password123")
    end

    assert @@user_db.get_users.count >= 3

    @@test_group.each do |user|
      assert @@user_db.get_user(UserFields::USERNAME, user)
    end
  end

  def test_passwords
    @@user_db.add(@@test_group[0], "password123")
    
    assert !@@user_db.check_user_password(@@test_group[0], "wrong")
    assert @@user_db.check_user_password(@@test_group[0], "password123")
  end

  def test_id
    @@user_db.add(@@test_group[0], "password123")

    user_id = @@user_db.get_id(@@test_group[0], "password123")
    assert user_id
    assert @@user_db.valid(user_id)
  end
end
