#!/usr/bin/env python2.7
import functools
import json
import os
import os.path
import signal
import subprocess
from os import listdir
from os.path import isfile, join

import pigpio
import psutil
from flask import render_template, send_from_directory, \
    json, request, flash, redirect, Response
from flask_login import current_user, login_user, logout_user, login_required
from flask_socketio import SocketIO, disconnect
from gevent import monkey

from app import app
from app.models import LoginForm
from app.models import User
from utils.custom_autodoc import CustomAutodoc as Autodoc

monkey.patch_all()

APP_ROOT = os.path.dirname(os.path.abspath(__file__))
STATIC_FOLDER = os.path.join(APP_ROOT, 'static')
CAPTURES_FOLDER = os.path.join(APP_ROOT, 'static', 'captures')

# -----[ APP CONFIGURATION AND ROUTING ]----- #
auto = Autodoc(app)
app.config['FLASK_HOST'] = os.environ.get('FLASK_HOST') or '0.0.0.0'
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

# turn the flask app into a socketio app
socketio = SocketIO(app)
pi = pigpio.pi()

# GPIO pins for servos
SERVO_L = 17
SERVO_R = 22


def get_status() -> str:
    """Retrieves stats about the Raspberry Pi's available memory, temperature,
    number of recordings, and camera status.

    Returns:
        str: A string representation of a device status dict
    """
    # general disk stats
    disk_status = psutil.disk_usage('/')
    total = int(disk_status.total / (1024.0 ** 3))
    used = int(disk_status.used / (1024.0 ** 3))
    percent = disk_status.percent
    image_count = len(os.listdir(CAPTURES_FOLDER))

    data = {
        'total': total,
        'used': used,
        'percent': percent,
        'acq_size': image_count,
        'camera_status': 'detected=1' in subprocess.check_output(
            'vcgencmd get_camera'.split()).decode('utf-8'),
        'temp': subprocess.check_output(
            'vcgencmd measure_temp'.split()).decode('utf-8').replace(
            'temp=', '')
    }
    return json.dumps(data)


def is_running(capture: bool) -> bool:
    """Checks current processes for active video feeds

    Arguments:
        capture: A bool flag for checking capture stream (vs regular stream)

    Returns:
        bool: A true/false indicating if the process was found
    """
    for pid in psutil.process_iter():
        if not capture and "gst-launch-1.0" in pid.name():
            return True
        elif capture and "capture.sh" in pid.name():
            return True
    return False


@app.after_request
def add_header(response):
    response.cache_control.no_store = True
    response.headers['Cache-Control'] = 'no-store,' \
                                        'no-cache,' \
                                        'must-revalidate,' \
                                        'post-check=0,' \
                                        'pre-check=0,' \
                                        'max-age=0 '
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'

    # Dataplicity specific fix for forcing https redirects through the nginx
    # proxy
    try:
        with open(APP_ROOT + '/raztot_url', 'r') as f:
            https_url = f.read().strip(' \t\n\r')
        if 'Location' in response.headers:
            response.headers['Location'] = https_url + response.headers[
                'Location'].replace('https://127.0.0.1:8000', '')
    except FileNotFoundError:
        pass

    return response


############################################################
# FLASK ROUTES
############################################################
@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect('/')

    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(
            username=form.username.data.lower()).first()
        if user is None or not user.check_password(form.password.data):
            flash('Invalid username or password')
            return redirect('/login')
        login_user(user)
        return redirect('/')
    return render_template('login.html', title='Sign In', form=form)


@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect('/login')


@app.route('/')
@auto.doc()
@login_required
def home():
    """The RazTot's home page. Provides access to video streaming and motor
    control.
    """
    if not os.path.isdir(STATIC_FOLDER + '/captures'):
        os.mkdir(os.path.abspath(STATIC_FOLDER) + '/captures')

    return render_template('index.html')


@app.route('/camera', methods=['GET', 'POST', 'DELETE'])
@auto.doc()
@login_required
def camera():
    """Manages video streaming state and handling of the streaming API key

    POST/DELETE: Start/stop stream
    GET: Fetch API key
    """
    if request.method == 'POST':
        if not is_running(False):
            print('Starting stream...')
            stream_proc = APP_ROOT + '/../utils/stream.sh'
            subprocess.Popen(stream_proc.split())

        return Response('{"response":"Success"}',
                        status=200,
                        mimetype='application/json')

    elif request.method == 'DELETE':
        gst_kill = 'pkill gst-launch-1.0'
        subprocess.call(gst_kill.split())
        return Response('{"response":"Success"}',
                        status=200,
                        mimetype='application/json')

    elif request.method == 'GET':
        return Response('{"janus_key":"' + os.environ.get('RANDOM_KEY') + '"}',
                        status=200,
                        mimetype='application/json')

    else:
        json_request = json.loads(request.data)
        if not json_request.get('record'):
            for pid in psutil.process_iter():
                if 'capture' in pid.name():
                    print("KILLING")
                    os.killpg(os.getpgid(pid.pid), signal.SIGINT)
            return Response('{"response":"Successfully stopped capture"}',
                            status=200,
                            mimetype='application/json')
        elif json_request.get('record'):
            capture_command = APP_ROOT + '/../utils/capture.sh'
            subprocess.Popen(capture_command.split(), preexec_fn=os.setsid)
            os.setpgrp()
            return Response('{"response":"Started capture"}',
                            status=200,
                            mimetype='application/json')
        else:
            return Response('{"response":"Unrecognized command"}',
                            status=400,
                            mimetype='application/json')


@app.route('/drive', methods=['DELETE'])
@auto.doc()
def drive():
    """Clears the RazTot's image directory.
    """
    all_files = [f for f in listdir(
        CAPTURES_FOLDER) if isfile(join(CAPTURES_FOLDER, f))]

    for i in range(len(all_files)):
        os.remove(CAPTURES_FOLDER + '/' + all_files[i])

    return Response('{"response":"Success"}', status=200,
                    mimetype='application/json')


@app.route('/documentation')
@auto.doc()
def documentation():
    """Displays formatted documentation for the application.
    """
    return auto.html(template='autodoc.html')


@app.route('/static/captures/<target>')
@login_required
def static_file(target):
    if not current_user.is_authenticated:
        return Response('{"Error":"Unauthorized"}',
                        status=403,
                        mimetype='application/json')

    return send_from_directory(CAPTURES_FOLDER + '/', target)


@app.route('/static/captures/')
@login_required
def list_captures():
    # Show directory contents
    files = os.listdir(CAPTURES_FOLDER)
    return render_template('files.html', files=files)


############################################################
# SOCKETIO
############################################################
def authenticated_only(f):
    @functools.wraps(f)
    def wrapped(*args, **kwargs):
        if not current_user.is_authenticated:
            disconnect()
        else:
            return f(*args, **kwargs)

    return wrapped


@socketio.on('connect', namespace='/raztot')
@authenticated_only
def socket_connect():
    print('##### CONNECTED ####')


@socketio.on('poll', namespace='/raztot')
@authenticated_only
def poll():
    """Fetches status messages for the Raspberry Pi.
    """
    socketio.emit('status', get_status(), namespace='/raztot', broadcast=True)


@socketio.on('move', namespace='/raztot')
@authenticated_only
def move(data):
    """
    Assuming mirrored motor setup for either side of the raztot, one side
    should turn clockwise and the other should turn counterclockwise to move
    forward, and the opposite for reversing. Turning is accomplished by moving
    the opposite wheel of the request (turning left moves the right wheel and
    uses the left wheel as a pivot, and vice versa).
    """
    if data is None:
        pi.set_servo_pulsewidth(SERVO_L, 0)
        pi.set_servo_pulsewidth(SERVO_R, 0)
    elif data.get('left') or data.get('right'):
        pi.set_servo_pulsewidth(SERVO_L, data.get('left') * 1000)
        pi.set_servo_pulsewidth(SERVO_R, data.get('right') * 2000)
    else:
        pi.set_servo_pulsewidth(SERVO_L, 2000 if data.get(
            'up') else 1000 * data.get('down'))
        pi.set_servo_pulsewidth(SERVO_R, 1000 if data.get(
            'up') else 2000 * data.get('down'))


@socketio.on('disconnect', namespace='/raztot')
@authenticated_only
def socket_disconnect():
    print('!!!! DISCONNECTED !!!!')


############################################################
# RUNNING
############################################################
def main():
    print('Running SocketIO app on ' + str(app.config['FLASK_HOST']) + '...')
    socketio.run(app,
                 host=app.config['FLASK_HOST'],
                 port=8000,
                 certfile=APP_ROOT + '/server.crt',
                 keyfile=APP_ROOT + '/server.key')


if __name__ == '__main__':
    main()
