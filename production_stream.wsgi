import os
import site
import sys

site.addsitedir('/home/pi/raztot/venv/lib/python2.7/site-packages')
sys.path.append('/home/pi/raztot/venv')
sys.path.append('/home/pi/raztot')
activate_this = '/home/pi/raztot/venv/bin/activate_this.py'
execfile(activate_this, dict(__file__=activate_this))

from routes import app as application
