from flask import Flask
from config.config import Config
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager

import os

print('Initializing...')
app = Flask(__name__, static_folder=os.path.dirname(os.path.abspath(__file__)) + '/static')
app.config.from_object(Config)

db = SQLAlchemy(app)
migrate = Migrate(app, db)
login = LoginManager(app)
login.login_view = '/login'

from app import models
