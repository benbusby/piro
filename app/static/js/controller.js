// Main janus api key
var janusKey;

var isRecording = false;
var isStreaming = false;
var isDownloading = false;
var isFullscreen = false;

var recorder;
var data = [];

var initialWidth;
var initialHeight;

$(document).ready(() => {
    const janusSetup = () => {
        if (isStreaming) {
            toggleStream();
            return;
        }

        if ($("#start-stream").hasClass("disabled")) {
            alert("Cannot start stream without a connected camera. Please connect the camera and try again.");
            return;
        }

        $("#start-stream").html('Launching...');
        startJanus(toggleStream);
    }

    const toggleStream = () => {
        if (isStreaming) {
            $("#start-stream").html('Stopping...');
            $("#stream-status").html("Off");
            $("#stream-status").removeClass("option-on");

            $("#recording-button").addClass("inner-disabled");
            $("#recording-button").removeClass("recording-inner");

            $("#image-button").addClass("inner-disabled");
            $("#image-button").removeClass("image-inner");

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
        $(".options-div").css("display", "inherit");

        sendCameraSetting('POST', new function () {
            $("#start-stream").html("Stop Stream");
            console.log("Successfully started stream");
        });
    }

    const toggleImage = () => {
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

    const toggleRecord = () => {
        if (!isStreaming) {
            return;
        }

        $(".secondary").toggleClass("active");

        if (!isRecording) {
            sendCameraSetting('PUT', new function () {
                isRecording = true;
                $("#indicator").html("Recording");
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

    const captureImage = () => {
        var video = $("#remotevideo")[0];
        var canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')
            .drawImage(video, 0, 0, canvas.width, canvas.height);

        var dataURL = canvas.toDataURL("image/jpeg", 1.0);
        var filename = new Date().toISOString();
        filename = filename.substring(0, filename.indexOf('.')) + '.jpg';

        var a = document.createElement('a');
        a.href = dataURL;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
    };

    const sendCameraSetting = (method, callback, data, skipAlert) => {
        $.ajax({
            type: method,
            url: '/camera',
            contentType: "application/json",
            cache: false,
            dataType: "json",
            data: JSON.stringify(data),
            processData: false,
            success: responseData => {
                typeof callback === 'function' && callback(responseData);
            },
            error: () => {
                typeof callback === 'function' && callback();
                if (!skipAlert) {
                    alert("There was an error sending the provided camera settings. Please check your network connection and the provided values, and try again.");
                }
            }
        });
    }

    sendCameraSetting('GET', data => {
        if (data && data.janus_key) {
            janusKey = data.janus_key;
        } else {
            alert('Janus api key was unable to be found. Video streaming will not work.');
        }
        console.log(data.janus_key);
    });

    $("#capture").click(captureImage);

    $("#toggle-fullscreen").click(() => {
        if (!isStreaming) {
            alert("Must be streaming to toggle fullscreen mode.");
            return;
        }

        if (!initialHeight || !initialWidth) {
            initialHeight = $("#stream-object").height();
            initialWidth = $("#stream-object").width();
        }

        if (isFullscreen) {
            isFullscreen = false;
            $("#start-stream").removeClass("hidden-element");
            $("#footer").removeClass("hidden-element");
            $("#indicator").removeClass("hidden-element");
            $(".options-div").removeClass("hidden-element");
            $(".primary").removeClass("hidden-element");
            $(".secondary").removeClass("hidden-element");

            $("#stream-object").height(initialHeight);
            $("#stream-object").width(initialWidth);
            $("#remotevideo").height(initialHeight);
            $("#remotevideo").width(initialWidth);
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

    $(window).bind('beforeunload', () => {
        $('#param-embed').remove();
        $('#stream-embed').remove();

        sendCameraSetting('DELETE', null, null, true);
    });

    $(".options-btn").on("click", () => {
        $(".options").toggleClass("open");
    });

    $(".slider").on("click", () => {
        $(".background").toggleClass("expand");
    });

    $("#clear-drive").on("click", () => {
        if (confirm("Are you sure you want to proceed with clearing the recordings folder?")) {
            $.ajax({
                type: 'DELETE',
                url: '/drive',
                contentType: false,
                cache: false,
                processData: false,
                success: () => {
                    alert("Recordings deleted!");
                },
                error: () => {
                    alert("Failed to clear out recordings.");
                }
            });
        }
    });
});

