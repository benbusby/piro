window.onload = () => {
    let ws = new WebSocket('ws://' + window.location.host + window.location.pathname);
    ws.onopen = () => { 
        console.log('websocket opened');

        // Start status loop
        send({status: 1})
    };
    ws.onclose = () => { console.log('websocket closed'); }
    ws.onmessage = msg => {
        try {
            JSON.parse(msg.data);
        } catch(err) {
            console.error("Bad json data from ws: " + err);
            return;
        }

        let data = JSON.parse(msg.data);

        // Always show main drive state, even if not streaming
        $('#drive-state').html(data['used'] + ' / ' + data['total'] +
            ' (' + data['percent'] + ' full)');

        if (parseFloat(data['percent']) > 75.0) {
            $('#drive-state').removeClass("option-caution");
            $('#drive-state').addClass("option-warning");
        } else if (parseFloat(data['percent']) > 50.0) {
            $('#drive-state').removeClass("option-warning");
            $('#drive-state').addClass("option-caution");
        }

        if (data['camera_status']) {
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

        // Show image count
        $('#acq-name').html(data['acq_size']);
        $('#temperature-status').html(data['temp']);
    };

    document.onkeydown = event => {
        send({move: {
            left:  (event.keyCode || event.which) == "37" ? 1 : 0,
            up:    (event.keyCode || event.which) == "38" ? 1 : 0,
            right: (event.keyCode || event.which) == "39" ? 1 : 0,
            down:  (event.keyCode || event.which) == "40" ? 1 : 0
        }});
    }

    document.onkeyup = function (event) {
        send({move: null});
    }

    const send = data => {
        ws.send(JSON.stringify(data));
    }

    setInterval(() => {
        send({status: 1});
    }, 1000);
}
