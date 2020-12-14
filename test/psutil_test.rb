require "minitest/autorun"
require "minitest/pride"
require "./app/models/psutil.rb"

class PsutilTest < Minitest::Test
  def test_get_disk_space
    disk_space = get_disk_space
    assert disk_space.length == 5
    ["total", "used", "remaining", "percent"].each do |key|
      assert disk_space[key].tr("^0-9", "").to_i
    end
  end

  def test_get_processes
    processes = get_processes
    ruby_proc = processes.select { |p|p.comm == "ruby" }
    assert ruby_proc.length >= 1

    fake_proc = processes.select { |p|p.comm == "fakeprocess" }
    assert fake_proc.length == 0
  end

  def test_get_proc_pid
    processes = get_processes
    bundle_proc = processes.select { |p|p.comm == "bundle" }
    proc_by_pid = get_processes(bundle_proc[0].pid)
    assert proc_by_pid
    assert bundle_proc[0].pid == proc_by_pid.pid
    assert bundle_proc[0].name == proc_by_pid.name
  end
end
