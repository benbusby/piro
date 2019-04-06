from threading import Thread, Event
from flask_socketio import SocketIO, emit
from subprocess import call
import subprocess
import struct
import binascii
import os.path
from os.path import isfile, join
import sys
import zmq
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

APP_ROOT = os.path.dirname(os.path.abspath(__file__))
STATIC_FOLDER = os.path.join(APP_ROOT, 'static')

#-----[ APP CONFIGURATION AND ROUTING ]-----#
app = Flask(__name__)
auto = Autodoc(app)

app.secret_key = os.urandom(24)

###############
app.config['FLASK_HOST'] = 'localhost'
test_ips = ['localhost', '192.168.0.69']
###############

app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

# turn the flask app into a socketio app
socketio = SocketIO(app)

# drive info ws thread
thread = Thread()
thread_stop_event = Event()

# base location of captured images
images_dir = '~/images/'


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
    data['acq_size'] = str(image_count)
    data['camera_status'] = ignore or "raspivid" in subprocess.check_output(
        'ps aux')
    return json.dumps(data)


def is_running():
    for pid in psutil.process_iter():
        if "raspivid" in pid.name():
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
    global thread
    thread_stop_event.clear()

    if not thread.isAlive():
        thread = SocketThread()
        thread.start()
        print('##### CONNECTED ####')


@socketio.on('disconnect', namespace='/raztot')
def socket_disconnect():
    thread_stop_event.set()
    print('!!!! DISCONNECTED !!!!')


@app.route('/camera', methods=['PUT', 'POST', 'DELETE'])
@auto.doc()
def camera():
    if request.method == 'POST':
        can_run = not is_running()

        if can_run and app.config['FLASK_HOST'] != 'localhost':
            ipoz_proc = "/home/nvidia/emc_wrapper.sh /home/nvidia/tegra_multimedia_api/samples/JetsonHWAccel/IPOZ_App/main_test.exe"
            subprocess.Popen(ipoz_proc.split())

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
