// Layout related values
var referenceTime = -1;
var startTime = -1;
var stopTime = -1;
var isRecording = false;
var isStreaming = false;
var isDownloading = false;
var isFullscreen = false;

// Camera constants
var STREAM_SET = 0;
var ACQ_SET = 1;
var DWNLD_SET = 2;
var EXP_SET = 3;
var AUTOEXP_SET = 4;
var AGAIN_SET = 5;
var DGAIN_SET = 6;
var APP_EXIT = 7;
var WB_KR_SET = 8;
var WB_KB_SET = 9;
var WB_KG_SET = 10;

// Ensure page is loaded before monitoring any user input
$(document).ready(function () {

    // Get current version number
    var request = new XMLHttpRequest();
    request.open('GET', "http://" + window.location.hostname + ":" + window.location.port + "/static/misc/current_version.txt", true);
    request.send(null);
    request.onreadystatechange = function () {
        if (request.readyState === 4 && request.status === 200) {
            $("#version-num").html(request.responseText);
        }
    }

    function janusSetup() {
        if (isStreaming) {
            toggleStream();
            return;
        }

        if ($("#start-stream").hasClass("disabled")) {
            alert("Cannot start stream while camera is offline. Please connect the camera and try again.");
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

            var formData = {
                message_type: APP_EXIT,
                video_run: false,
                app_run: false
            }

            // Send DELETE to the camera api to disable the stream
            sendCameraSetting(formData, function () {
                $.ajax({
                    type: 'DELETE',
                    url: '/camera',
                    contentType: false,
                    cache: false,
                    processData: false,
                    success: function () {
                        $("#start-stream").html('Start Stream');
                        $("#param-embed").remove();
                        $("#stream-embed").remove();
                        isStreaming = false;
                    },
                    error: function () {
                        console.error("Failed to kill stream");
                        bootbox.alert("Failed to stop stream");
                    }
                });
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

        $.ajax({
            type: 'POST',
            url: '/camera',
            contentType: false,
            cache: false,
            processData: false,
            success: function (data) {
                setTimeout(function () {
                    sendCameraSetting({
                        message_type: STREAM_SET,
                        video_run: true,
                        app_run: true
                    });
                }, 3000);
            },
            error: function (e) {
                console.error(e);
                bootbox.alert("There was an error retrieving the stream.");
            }
        });

        return false;
    }

    // Pauses live stream and begins download for all recently captured images
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
            bootbox.alert("Must be streaming to toggle image acquisition.");
            return;
        }

        $(".button").toggleClass("active");

        if (!isRecording) {
            isRecording = true;
            $("#indicator").html("Capturing");
            $("#indicator").addClass("element-fade");

            $("#acquisition-status").html("On");
            $("#acquisition-status").addClass("option-on");

            sendCameraSetting({
                message_type: ACQ_SET,
                acq_run: true,
                app_run: true
            });
        } else {
            isRecording = false;
            $("#toggle-record").removeAttr("background-color");
            $("#indicator").html("");
            $("#indicator").removeClass("element-fade");

            $("#acquisition-status").html("Off");
            $("#acquisition-status").removeClass("option-on");

            var formData = {
                message_type: ACQ_SET,
                acq_run: false,
                app_run: true
            };
            sendCameraSetting(formData);
        }
    }

    // Updates a single setting for the camera
    function sendCameraSetting(formData, callback) {
        $.ajax({
            type: 'PUT',
            url: '/camera',
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify(formData),
            cache: false,
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

    // Fetches the most recent color thumbnail to display in a dialog
    function refreshThumbnail() {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/camera', true);
        xhr.responseType = "blob";
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (xhr.response.type !== 'application/json') {
                    // Create an object url to replace the img src
                    $("#latest-thumbnail").attr("src", URL.createObjectURL(xhr.response));
                } else {
                    console.error(xhr.response.type);
                }
            }
        };

        xhr.onerror = function () {
            bootbox.alert("Unable to retrieve thumbnail.");
        }
        xhr.send();
    }

    // ----------------------------------------------------------------------------------
    // Click Handlers
    // ----------------------------------------------------------------------------------
    $("#show-thumbnail").click(function () {
        $('#dialog').dialog('open');
        refreshThumbnail();
    });

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

    $("#refresh-thumbnail").on('click', refreshThumbnail);
    $("#start-stream").on('click', janusSetup);
    $(".button").on('click', toggleRecord);
    $("#download-data").on('click', startDownload);

    $(window).bind('beforeunload', function () {
        $('#param-embed').remove();
        $('#stream-embed').remove();

        formData = {
            message_type: APP_EXIT,
            video_run: false,
            app_run: false
        }

        sendCameraSetting(formData, function () {
            $.ajax({
                type: 'DELETE',
                url: '/camera',
                contentType: false,
                cache: false,
                processData: false,
                success: function () {
                    console.log("Successfully killed stream");
                },
                error: function () {
                    console.error("Failed to kill stream");
                }
            });
        });
    });

    $(".options-btn").on("click", function () {
        $(".options").toggleClass("open");
    });

    $(".slider").on("click", function () {
        $(".background").toggleClass("expand");
    });

    $("input:file").change(handleUpdate);

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

    function handleUpdate() {
        var fileSelect = document.getElementById('file-upload');
        var fileList = Array.from(fileSelect.files);
        var formData = new FormData();
        var xhr = new XMLHttpRequest();

        let keyFile = fileList.find(x => x.name === 'key.bin.enc');
        let updateFile = fileList.find(x => x.name === 'data.zip.enc');
        let scriptFile = fileList.find(x => x.name === 'decrypt_upload.sh.enc');

        if (fileList.length === 2 && updateFile && keyFile) {
            formData.append("update_file", updateFile);
            formData.append("key_file", keyFile);

            xhr.open('POST', '/update', true);
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4 && xhr.status === 200) {
                    bootbox.alert("Update file(s) successfully integrated -- please refresh this page for changes to take effect.");
                } else if (xhr.readyState === 4 && xhr.status === 403) {
                    alert("Unable to update system using the provided files. Please make sure you included both the tar file and random key, and that they are the same pair that was originally sent to you.");
                    return;
                }
            }

            xhr.onerror = function (e) {
                bootbox.alert("Unable to upload update file. " + e);
            }
        } else if (fileList.length === 2 && scriptFile && keyFile) {
            formData.append("update_script", scriptFile);
            formData.append("key_file", keyFile);

            xhr.open('POST', '/update', true);
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4 && xhr.status === 200) {
                    bootbox.alert("Update file successfully integrated.");
                } else if (xhr.readyState === 4 && xhr.status === 403) {
                    alert("Unable to update the installation script. Please ensure that the binary file has not been modified since initial receipt.");
                    return;
                }
            }

            xhr.onerror = function (e) {
                bootbox.alert("Unable to upload update file. " + e);
            }
        } else {
            alert("Unrecognized file upload. Please try again.");
            return;
        }

        xhr.send(formData);
    }
});

