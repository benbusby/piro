$(document).ready(function () {
    // Connect to the socket server
    var socket = io.connect('http://' + document.domain + ':' + location.port + '/raztot', { timeout: 5000 });

    socket.emit('poll');

    document.onkeydown = function (event) {
        socket.emit('move', {
            left: event.keyCode == "37" ? 1 : 0,
            up: event.keyCode == "38" ? 1 : 0,
            right: event.keyCode == "39" ? 1 : 0,
            down: event.keyCode == "40" ? 1 : 0
        });
    }

    document.onkeyup = function (event) {
        socket.emit('move', null);
    }

    // Receieve status messages through socket connection
    socket.on('status', function (msg) {
        msg = JSON.parse(msg);

        // Always show main drive state, even if not streaming
        $('#drive-state').html(msg['used'] + ' / ' + msg['total'] +
            ' GB (' + msg['percent'] + '% full)');

        if (parseFloat(msg['percent']) > 75.0) {
            $('#drive-state').removeClass("option-caution");
            $('#drive-state').addClass("option-warning");
        } else if (parseFloat(msg['percent']) > 50.0) {
            $('#drive-state').removeClass("option-warning");
            $('#drive-state').addClass("option-caution");
        }

        if (msg['camera_status']) {
            $("#camera-state").html("Online");
            if (!$("#camera-state").hasClass("inner-disabled")) {
                $("#camera-state").addClass("option-on");
            }
            $("#start-stream").removeClass("disabled");
        } else {
            $("#camera-state").html("Offline");
            $("#camera-state").removeClass("option-on");
            if (!$("#start-stream").hasClass("disabled")) {
                $("#start-stream").addClass("disabled");
            }
        }

        // Show acquisition status if streaming
        if (isStreaming) {
            $('#acq-name').html("\"" + msg['current_acq'] + "\": " + msg['acq_size'] + " images");
        } else {
            $('#acq-name').html("Acquisition Status: N/A");
        }

        setTimeout(function () {
            socket.emit('poll');
        }, 500);
    });

    $(window).bind('beforeunload', function () {
        socket.disconnect();
    });

});
