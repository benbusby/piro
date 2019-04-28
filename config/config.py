import os
basedir = os.path.abspath(os.path.dirname(__file__))

class Config(object):
    #SECRET_KEY = os.environ.get('SECRET_KEY') or '\x8eph_3\x06\xf2\xe3\x9d\xf0\xbd\xc1Kr]\xed_\x03o5E\xfd\x04A'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(basedir, '../app/app.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

