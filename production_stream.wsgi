import os
import site
import sys

site.addsitedir('~/raztot/venv/lib/python2.7/site-packages')
sys.path.append('~/raztot/venv')
sys.path.append('~/raztot')
activate_this = '~/raztot/venv/bin/activate_this.py'
execfile(activate_this, dict(__file__=activate_this))

from routes import app as application
