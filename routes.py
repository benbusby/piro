#!/usr/bin/env python2.7
import grequests
import pigpio
import shutil
import json
from time import sleep
import time
from os import listdir
import os
import psutil
from utils.custom_autodoc import CustomAutodoc as Autodoc
from flask import Flask, render_template, after_this_request, json, request, flash, redirect, Response, make_response, send_file, session
from functools import wraps
import sys
from os.path import isfile, join
import os.path
import binascii
import struct
import subprocess
from subprocess import call
from flask_socketio import SocketIO, emit
from threading import Thread, Event
from gevent import monkey
monkey.patch_all()


APP_ROOT = os.path.dirname(os.path.abspath(__file__))
STATIC_FOLDER = os.path.join(APP_ROOT, 'static')
UPLOAD_FOLDER = os.path.join(APP_ROOT, 'static', 'captures')

#-----[ APP CONFIGURATION AND ROUTING ]-----#
app = Flask(__name__)
auto = Autodoc(app)

app.secret_key = os.urandom(24)

###############
app.config['FLASK_HOST'] = '0.0.0.0'
test_ips = ['localhost', '192.168.0.14']
###############

app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

# turn the flask app into a socketio app
socketio = SocketIO(app)

# drive info ws thread
thread = Thread()
thread_stop_event = Event()
pi = pigpio.pi()

# GPIO pins for servos
SERVO_L = 17
SERVO_R = 22


def get_status():
    '''
    Retrieves stats about the Raspberry Pi's available memory, temperature,
    number of recordings, and camera status.
    '''
    # general disk stats
    disk_status = psutil.disk_usage('/')
    total = int(disk_status.total / (1024.0 ** 3))
    used = int(disk_status.used / (1024.0 ** 3))
    percent = disk_status.percent
    image_count = len(os.listdir(UPLOAD_FOLDER))

    data = {}
    data['total'] = total
    data['used'] = used
    data['percent'] = percent
    data['acq_size'] = image_count
    data['camera_status'] = 'detected=1' in subprocess.check_output(
        'vcgencmd get_camera'.split())
    data['temp'] = subprocess.check_output(
        'vcgencmd measure_temp'.split()).replace('temp=', '')
    return json.dumps(data)


def is_running():
    for pid in psutil.process_iter():
        if "gst-launch-1.0" in pid.name():
            return True
    return False


@app.after_request
def add_header(response):
    response.cache_control.no_store = True
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response

############################################################
# FLASK ROUTES
############################################################
@app.route('/')
@auto.doc()
def home():
    '''
    The application's home page.
    '''
    return render_template('index.html')


@app.route('/camera', methods=['GET', 'PUT', 'POST', 'DELETE'])
@auto.doc()
def camera():
    '''
    Starts (POST) or stops (DELETE) stream, or fetches (GET) the janus streaming api key
    '''
    if request.method == 'POST':
        if not is_running() and app.config['FLASK_HOST'] != 'localhost':
            print('Starting stream...')
            stream_proc = "/home/pi/raztot/utils/stream.sh"
            subprocess.Popen(stream_proc.split())

        return Response('{"response":"Success"}', status=200, mimetype='application/json')

    elif request.method == 'DELETE':
        gstkill = "pkill gst-launch-1.0"
        subprocess.call(gstkill.split())
        return Response('{"response":"Success"}', status=200, mimetype='application/json')

    elif request.method == 'GET':
        return Response('{"janus_key":"' + os.environ.get('RANDOM_KEY') + '"}', status=200, mimetype='application/json')

    else:
        # TODO: Capture images
        return Response('{"response":"Not set up"}', status=200, mimetype='application/json')


@app.route('/documentation')
@auto.doc()
def documentation():
    '''
    Displays formatted documentation for the application.
    '''
    return auto.html(template='autodoc.html')


############################################################
# WEBSOCKETS
############################################################
@socketio.on('connect', namespace='/raztot')
def socket_connect():
    print('##### CONNECTED ####')


@socketio.on('poll', namespace='/raztot')
def poll():
    '''
    Fetches status messages for the Raspberry Pi.
    '''
    socketio.emit('status', get_status(), namespace='/raztot', broadcast=True)


@socketio.on('move', namespace='/raztot')
def move(data):
    '''
    Assuming mirrored motor setup for either side of the raztot, one side should turn
    clockwise and the other should turn counterclockwise to move forward, and the 
    opposite for reversing. Turning is accomplished by moving the opposite wheel (turning left moves the right wheel and uses the left wheel as a pivot, and vice versa).
    '''
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
def socket_disconnect():
    print('!!!! DISCONNECTED !!!!')


if __name__ == '__main__':
    if len(sys.argv) > 1:
        app.config['FLASK_HOST'] = str(sys.argv[1])
    socketio.run(app, host=app.config['FLASK_HOST'], port=8000)
