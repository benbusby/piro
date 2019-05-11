// Main janus api key
var janusKey;

// Layout related values
var isRecording = false;
var isStreaming = false;
var isDownloading = false;
var isFullscreen = false;

var recorder;
var data = [];

$(document).ready(function () {

    // Get current version number
    var request = new XMLHttpRequest();
    request.open('GET', "/static/misc/current_version.txt", true);
    request.send(null);
    request.onreadystatechange = function () {
        if (request.readyState === 4 && request.status === 200) {
            $("#version-num").html(request.responseText);
        }
    }

    sendCameraSetting('GET', function (data) {
	if (data.janus_key) {
        janusKey = data.janus_key;
	} else {
        alert('Janus api key was unable to be found. Video streaming will not work.');
	}
	console.log(data.janus_key);
    });

    // Starts janus session if camera is connected and not already streaming
    function janusSetup() {
        if (isStreaming) {
            toggleStream();
            return;
        }

        // Uses vcgencmd get_camera to see if the camera is properly connected
        if ($("#start-stream").hasClass("disabled")) {
            alert("Cannot start stream without a connected camera. Please connect the camera and try again.");
            return;
        }

        startJanus(toggleStream);
    }

    // Begins the stream if not running, otherwise kills the stream
    function toggleStream() {
        if (isStreaming) {
            $("#stream-status").html("Off");
            $("#stream-status").removeClass("option-on");

            // Disable capture buttons
            $("#recording-button").addClass("inner-disabled");
            $("#recording-button").removeClass("recording-inner");

            $("#image-button").addClass("inner-disabled");
            $("#image-button").removeClass("image-inner");

            // Send DELETE to the camera api to disable the stream
            sendCameraSetting('DELETE', new function () {
                $("#start-stream").html('Start Stream');
                $("#param-embed").remove();
                $("#stream-embed").remove();
                $("#remotevideo").fadeOut(300, function () {
                    $(this).remove();
                });
                isStreaming = false;
            });

            return;
        }

        // If the capture buttons have been disabled, re-enable them
        if ($("#recording-button").hasClass("inner-disabled")) {
            $("#recording-button").removeClass("inner-disabled");
            $("#recording-button").addClass("recording-inner");
        }

        if ($("#image-button").hasClass("inner-disabled")) {
            $("#image-button").removeClass("inner-disabled");
            $("#image-button").addClass("image-inner");
        }

        $("#stream-status").html("Live");
        $("#stream-status").addClass("option-on");

        isStreaming = true;
        $("#start-stream").html('Stop Stream');
        $(".options-div").css('display', 'inherit');

        sendCameraSetting('POST', new function () {
            console.log("Successfully started stream");
        });
    }

    // Snaps a picture and saves the result locally
    function toggleImage() {
        if (!isStreaming) {
            //alert("Must be streaming to take picture.");
            return;
        }

        $(".primary").toggleClass("active");
        captureImage();

        setTimeout(function () {
            $(".primary").toggleClass("active");
        }, 250);
    }

    // Starts/stops capture -- starting capture acquires images from the stream at ~1hz
    function toggleRecord() {
        if (!isStreaming) {
            //alert("Must be streaming to begin recording.");
            return;
        }

        $(".secondary").toggleClass("active");
        
        if (!isRecording) {
            sendCameraSetting('PUT', new function () {
                isRecording = true;
                $("#indicator").html("Capturing");
                $("#indicator").addClass("element-fade");

                $("#acquisition-status").html("On");
                $("#acquisition-status").addClass("option-on");
            }, { record: true });
        } else {
            sendCameraSetting('PUT', new function () {
                isRecording = false;
                $("#toggle-record").removeAttr("background-color");
                $("#indicator").html("");
                $("#indicator").removeClass("element-fade");

                $("#acquisition-status").html("Off");
                $("#acquisition-status").removeClass("option-on");
            }, { record: false });
        }
    }

    var captureImage = function() {
        // Create canvas element to capture frame of video
        var video = $("#remotevideo")[0];
        var canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')
              .drawImage(video, 0, 0, canvas.width, canvas.height);

        var dataURL = canvas.toDataURL("image/jpeg", 1.0);
        var filename = new Date().toISOString();
        filename = filename.substring(0, filename.indexOf('.'));

        // Save image with dummy anchor
        var a = document.createElement('a');
        a.href = dataURL;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
    };

    // Updates camera to start, stop, or record a stream
    function sendCameraSetting(method, callback, data, skipAlert) {
        $.ajax({
            type: method,
            url: '/camera',
            contentType: "application/json",
            cache: false,
            dataType: "json",
            data: JSON.stringify(data),
            processData: false,
            success: function (responseData) {
                typeof callback === 'function' && callback(responseData);
            },
            error: function () {
                typeof callback === 'function' && callback();
                if (!skipAlert) {                
                    alert("There was an error sending the provided camera settings. Please check your network connection and the provided values, and try again.");
                }
            }
        });
    }

    // ----------------------------------------------------------------------------------
    // Click Handlers
    // ----------------------------------------------------------------------------------
    $("#capture").click(captureImage);

    $("#toggle-fullscreen").click(function () {
        if (!isStreaming) {
            alert("Must be streaming to toggle fullscreen mode.");
            return;
        }

        if (isFullscreen) {
            isFullscreen = false;
            $("#start-stream").removeClass("hidden-element");
            $("#footer").removeClass("hidden-element");
            $("#indicator").removeClass("hidden-element");
            $(".options-div").removeClass("hidden-element");
            $(".primary").removeClass("hidden-element");
            $(".secondary").removeClass("hidden-element");

            $("#stream-object").height(540);
            $("#stream-object").width(960);
            $("#remotevideo").height(540);
            $("#remotevideo").width(960);
            $("#remotevideo").css('object-fit', 'contain');

            $("#right-footer").css('background-color', 'rgba(0, 0, 0, 0)');
            $("#right-footer").css('box-shadow', '0px 0px 25px 25px rgba(0,0,0, 0)');
        } else {
            isFullscreen = true;
            $("#start-stream").addClass("hidden-element");
            $("#footer").addClass("hidden-element");
            $("#indicator").addClass("hidden-element");
            $(".options-div").addClass("hidden-element");
            $(".primary").addClass("hidden-element");
            $(".secondary").addClass("hidden-element");

            $("#stream-object").css('width', '100%');
            $("#stream-object").css('height', '100%');
            $("#remotevideo").css('width', '100%');
            $("#remotevideo").css('height', '100%');
            $("#remotevideo").css('object-fit', 'fill');

            $("#right-footer").css('background-color', 'rgba(0, 0, 0, 0.85)');
            $("#right-footer").css('box-shadow', '0px 0px 25px 25px rgba(0,0,0, 0.85)');
        }
    });

    $("#start-stream").on('click', janusSetup);

    $(".primary").on('click', toggleImage);
    $(".secondary").on('click', toggleRecord);

    $(window).bind('beforeunload', function () {
        $('#param-embed').remove();
        $('#stream-embed').remove();

        sendCameraSetting('DELETE', null, null, true);
    });

    $(".options-btn").on("click", function () {
        $(".options").toggleClass("open");
    });

    $(".slider").on("click", function () {
        $(".background").toggleClass("expand");
    });

    $("#clear-drive").on("click", function () {
        if (confirm("Are you sure you want to proceed with clearing the recordings folder?")) {
            $.ajax({
                type: 'DELETE',
                url: '/drive',
                contentType: false,
                cache: false,
                processData: false,
                success: function () {
                    alert("Recordings deleted!");
                },
                error: function () {
                    alert("Failed to clear out recordings.");
                }
            });
        }
    });
});

