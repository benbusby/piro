// Layout related values
var isRecording = false;
var isStreaming = false;
var isDownloading = false;
var isFullscreen = false;

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

    // Starts janus session if camera is connected and not already streaming
    function janusSetup() {
        if (isStreaming) {
            toggleStream();
            return;
        }

        // Uses vcgencmd get_camera to see if the camera is properly connected
        if ($("#start-stream").hasClass("disabled")) {
            bootbox.alert("Cannot start stream without a connected camera. Please connect the camera and try again.");
            return;
        }

        startJanus(toggleStream);
    }

    // Begins the stream if not running, otherwise kills the stream
    function toggleStream() {
        if (isStreaming) {
            $("#stream-status").html("Off");
            $("#stream-status").removeClass("option-on");

            // Disable capture button
            $("#recording-button").addClass("inner-disabled");
            $("#recording-button").removeClass("inner");

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

        // If the capture button has been disabled, re-enable it
        if ($("#recording-button").hasClass("inner-disabled")) {
            $("#recording-button").removeClass("inner-disabled");
            $("#recording-button").addClass("inner");
        }

        $("#stream-status").html("Live");
        $("#stream-status").addClass("option-on");

        isStreaming = true;
        $("#start-stream").html('Stop Stream');
        $(".button").css('display', 'inherit');
        $(".options-div").css('display', 'inherit');

        sendCameraSetting('POST', new function () {
            console.log("Successfully started stream");
        });
    }

    // Pauses live stream and begins download for all recently captured videos
    function startDownload() {
        if (isDownloading) {
            return;
        }

        $("#download-data").html("Downloading, please wait...");
        $("#download-data").addClass("option-disabled");
        isDownloading = true;

        sendCameraSetting({
            message_type: DWNLD_SET,
            dwnld_flag: true
        }, function () {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', '/download', true);
            xhr.responseType = "blob";
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (xhr.response.type !== 'application/json') {
                        var blob = xhr.response;
                        $('body').append('<a id="download-zip">&nbsp;</a>');
                        var anchor = $("#download-zip");

                        var filename = "download.zip";
                        var disposition = xhr.getResponseHeader('Content-Disposition');
                        if (disposition && disposition.indexOf('attachment') !== -1) {
                            var filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                            var matches = filenameRegex.exec(disposition);
                            if (matches != null && matches[1]) {
                                filename = matches[1].replace(/['"]/g, '');
                            }
                        }

                        anchor.attr({
                            href: window.URL.createObjectURL(blob),
                            target: '_blank',
                            download: filename
                        })[0].click();
                    } else {
                        console.error(xhr.response.type);
                    }

                    $("#download-data").html("Download Data");
                    $("#download-data").removeClass("option-disabled");
                    isDownloading = false;
                    sendCameraSetting({
                        message_type: DWNLD_SET,
                        dwnld_flag: false
                    });
                }
            };

            xhr.onerror = function () {
                bootbox.alert("Unable to download zip file.");
            }
            xhr.send();
        });
    }

    // Starts/stops capture -- starting capture acquires images from the stream at ~1hz
    function toggleRecord() {
        if (!isStreaming) {
            bootbox.alert("Must be streaming to begin recording.");
            return;
        }

        $(".button").toggleClass("active");

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

    // Updates camera to start, stop, or record a stream
    function sendCameraSetting(method, callback, data) {
        $.ajax({
            type: method,
            url: '/camera',
            contentType: "application/json",
            cache: false,
            dataType: "json",
            data: JSON.stringify(data),
            processData: false,
            success: function (data) {
                typeof callback === 'function' && callback();
            },
            error: function () {
                typeof callback === 'function' && callback();
                bootbox.alert("There was an error sending the provided camera settings. Please check your network connection and the provided values, and try again.");
            }
        });
    }

    // ----------------------------------------------------------------------------------
    // Click Handlers
    // ----------------------------------------------------------------------------------
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
            $(".button").removeClass("hidden-element");

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
            $(".button").addClass("hidden-element");

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
    $(".button").on('click', toggleRecord);
    $("#download-data").on('click', startDownload);

    $(window).bind('beforeunload', function () {
        $('#param-embed').remove();
        $('#stream-embed').remove();

        sendCameraSetting('DELETE');
    });

    $(".options-btn").on("click", function () {
        $(".options").toggleClass("open");
    });

    $(".slider").on("click", function () {
        $(".background").toggleClass("expand");
    });

    $("#clear-drive").on("click", function () {
        if (confirm("Are you sure you want to proceed with clearing the drive?")) {
            $.ajax({
                type: 'DELETE',
                url: '/drive',
                contentType: false,
                cache: false,
                processData: false,
                success: function () {
                    bootbox.alert("Drive cleared!");
                },
                error: function () {
                    bootbox.alert("Failed to clear drive.");
                }
            });
        }
    });
});

