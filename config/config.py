import os

basedir = os.path.abspath(os.path.dirname(__file__))


class Config(object):
    SECRET_KEY = os.environ.get('SECRET_KEY', os.urandom(32))
    SQLALCHEMY_DATABASE_URI = (
        os.environ.get('DATABASE_URL',
                       'sqlite:///' + os.path.join(basedir, '../app/app.db')))

    SQLALCHEMY_TRACK_MODIFICATIONS = False
