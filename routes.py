#!/usr/bin/env python2.7

from threading import Thread, Event
from flask_socketio import SocketIO, emit
from subprocess import call
import subprocess
import struct
import binascii
import os.path
from os.path import isfile, join
import sys
from functools import wraps
from flask import Flask, render_template, after_this_request, json, request, flash, redirect, Response, make_response, send_file, session
from custom_autodoc import CustomAutodoc as Autodoc
import psutil
import os
from os import listdir
import time
from time import sleep
import json
import shutil
import pigpio

APP_ROOT = os.path.dirname(os.path.abspath(__file__))
STATIC_FOLDER = os.path.join(APP_ROOT, 'static')

#-----[ APP CONFIGURATION AND ROUTING ]-----#
app = Flask(__name__)
auto = Autodoc(app)

app.secret_key = os.urandom(24)

###############
app.config['FLASK_HOST'] = 'localhost'
test_ips = ['localhost', '192.168.0.15']
###############

app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

# turn the flask app into a socketio app
socketio = SocketIO(app)

# drive info ws thread
thread = Thread()
thread_stop_event = Event()
pi = pigpio.pi()

# base location of captured images
images_dir = '/home/pi/images/'

# GPIO pins for servos
SERVO_L = 17
SERVO_R = 22


class SocketThread(Thread):
    def __init__(self):
        self.delay = 0.5
        super(SocketThread, self).__init__()

    def websocket(self):
        while not thread_stop_event.isSet():
            # send down drive status every .5s
            socketio.emit('status', get_status(), namespace='/raztot')
            sleep(self.delay)

    def run(self):
        self.websocket()


def get_current_image_dir():
    all_dirs = [f for f in listdir(
        images_dir) if not isfile(join(images_dir, f))]

    max_time = 0
    for i in range(len(all_dirs)):
        if (int(all_dirs[i]) > max_time):
            max_time = int(all_dirs[i])

    return max_time


def get_latest_image():
    all_images = [f for f in listdir(
        images_dir) if isfile(join(images_dir, f))]

    max_time = 0
    for i in range(len(all_images)):
        if '.jpg' not in all_images[i]:
            continue

        image_time = int(all_images[i].replace(".jpg", ""))
        if image_time > max_time:
            max_time = image_time

    return max_time


def get_status():
    # general disk stats
    disk_status = psutil.disk_usage('/')
    total = int(disk_status.total / (1024.0 ** 3))
    used = int(disk_status.used / (1024.0 ** 3))
    percent = disk_status.percent
    image_count = len(os.listdir(images_dir))

    ignore = app.config['FLASK_HOST'] in test_ips or is_running()

    data = {}
    data['total'] = total
    data['used'] = used
    data['percent'] = percent
    data['acq_size'] = image_count
    data['camera_status'] = 'detected=1' in subprocess.check_output('vcgencmd get_camera'.split())
    data['temp'] = subprocess.check_output('vcgencmd measure_temp'.split()).replace('temp=', '')
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


@app.route('/')
@auto.doc()
def home():
    '''
    The application's home page.
    '''
    return render_template('index.html')


@app.route('/images', methods=['GET', 'DELETE'])
@auto.doc()
def drive():
    '''
    Downloads (GET) or clears (DELETE) the drive's image capture directory.
    '''
    if request.method == 'GET':
        if request.args.get('all'):
            max_time = get_current_image_dir()

            full_path = images_dir + '/' + str(max_time)
            zip_path = app.config['UPLOAD_FOLDER'] + "/" + str(max_time)

            shutil.make_archive(zip_path, 'zip', full_path)

            @after_this_request
            def remove_file(response):
                try:
                    os.remove(zip_path + '.zip')
                except Exception as error:
                    app.logger.error(
                        "Error removing downloaded zip file", error)
                return response

            return send_file(zip_path + '.zip', mimetype='application/octet-stream', attachment_filename=str(max_time) + '.zip', as_attachment=True)
        else:
            latest_image = get_latest_image()
            return send_file(images_dir + '/' + str(latest_image) + '.jpg', mimetype='image/gif')
    elif request.method == 'DELETE':
        all_images = [f for f in listdir(
            images_dir) if isfile(join(images_dir, f))]

        for i in range(len(all_images)):
            shutil.rmtree(images_dir + '/' + all_images[i])
    else:
        return Response('{"response":"Error"}', status=400, mimetype='application/json')

    return Response('{"response":"Success"}', status=200, mimetype='application/json')


@socketio.on('connect', namespace='/raztot')
def socket_connect():
    #global thread
    # thread_stop_event.clear()

    # if not thread.isAlive():
    #    thread = SocketThread()
    #    thread.start()
    print('##### CONNECTED ####')


@socketio.on('poll', namespace='/raztot')
def poll():
    socketio.emit('status', get_status(), namespace='/raztot', broadcast=True)


@socketio.on('move', namespace='/raztot')
def move(data):
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
    # thread_stop_event.set()
    print('!!!! DISCONNECTED !!!!')


@app.route('/camera', methods=['PUT', 'POST', 'DELETE'])
@auto.doc()
def camera():
    if request.method == 'POST':
        can_run = not is_running()

        if can_run and app.config['FLASK_HOST'] != 'localhost':
            print('Starting stream...')
            stream_proc = "/home/pi/raztot/stream.sh"
            subprocess.Popen(stream_proc.split())

        return Response('{"response":"Success"}', status=200, mimetype='application/json')

    elif request.method == 'DELETE':
        gstkill = "pkill gst-launch-1.0"
        subprocess.call(gstkill.split())
        return Response('{"response":"Success"}', status=200, mimetype='application/json')

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


if __name__ == '__main__':
    if len(sys.argv) > 1:
        app.config['FLASK_HOST'] = str(sys.argv[1])
    socketio.run(app, host=app.config['FLASK_HOST'], port=8000)
