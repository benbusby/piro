#!/usr/bin/env ruby

require 'sys/proctable'
include Sys

def get_disk_space
  keys = ['total', 'used', 'remaining', 'percent', 'partition']
  output = `df -h /`
  Hash[keys.zip(output.split(' ')[-5,5])]
end

def get_processes(pid = nil)
  ProcTable.ps(smaps: false, thread_info: false, pid: pid)
end
