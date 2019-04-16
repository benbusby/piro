// Janus gateway values
var server = null;
if (window.location.protocol === 'http:') {
    server = "http://" + window.location.hostname + ":8088/janus";
} else {
    server = "https://" + window.location.hostname + ":8089/janus";
}

var janus = null;
var streaming = null;
var opaqueId = "raztot-" + Janus.randomString(12);

var bitrateTimer = null;
var spinner = null;

var simulcastStarted = false, svcStarted = false;

var selectedStream = null;

function startStream() {
    Janus.log("Selected video id #" + selectedStream);
    $('#streamset').attr('disabled', true);
    $('#streamslist').attr('disabled', true);
    $('#watch').attr('disabled', true).unbind('click');
    var body = { "request": "watch", id: parseInt(selectedStream) };
    streaming.send({ "message": body });
    // No remote video yet
    $('#stream').append('<video class="rounded centered" id="waitingvideo" width=960 height=540 />');
}

function stopStream() {
    var body = { "request": "stop" };
    streaming.send({ "message": body });
    streaming.hangup();
    if (bitrateTimer !== null && bitrateTimer !== undefined)
        clearInterval(bitrateTimer);
    bitrateTimer = null;
}

function startJanus(callback) {
    if (streaming != null) {
        Janus.log("Plugin attached! (" + streaming.getPlugin() + ", id=" + streaming.getId() + ")");
        selectedStream = 222;
        startStream();

        typeof callback === 'function' && callback(true);
        return;
    }

    // Initialize the library (all console debuggers enabled)
    Janus.init({
        debug: "all", callback: function () {
            // Create session
            janus = new Janus({
                server: server,
                success: function () {
                    // Attach to streaming plugin
                    janus.attach({
                        plugin: "janus.plugin.streaming",
                        opaqueId: opaqueId,
                        success: function (pluginHandle) {
                            streaming = pluginHandle;
                            Janus.log("Plugin attached! (" + streaming.getPlugin() + ", id=" + streaming.getId() + ")");

                            selectedStream = 222; // Hardcoded since there should only be the one stream
                            startStream();

                            $('#start-stream').click(function () {
                                $(this).attr('disabled', true);
                                
                                clearInterval(bitrateTimer);
                                //janus.destroy();
                                stopStream();
                            });

                            typeof callback === 'function' && callback(true);
                        },
                        error: function (error) {
                            Janus.error("  -- Error attaching plugin... ", error);
                            bootbox.alert("Error attaching plugin... " + error);
                        },
                        onmessage: function (msg, jsep) {
                            Janus.debug(" ::: Got a message :::");
                            Janus.debug(msg);
                            var result = msg["result"];
                            if (result !== null && result !== undefined) {
                                if (result["status"] !== undefined && result["status"] !== null) {
                                    var status = result["status"];
                                    if (status === 'starting')
                                        $('#status').removeClass('hide').text("Starting, please wait...").show();
                                    else if (status === 'started')
                                        $('#status').removeClass('hide').text("Started").show();
                                    else if (status === 'stopped')
                                        stopStream();
                                } else if (msg["streaming"] === "event") {
                                    // Is simulcast in place?
                                    var substream = result["substream"];
                                    var temporal = result["temporal"];
                                    if ((substream !== null && substream !== undefined) || (temporal !== null && temporal !== undefined)) {
                                        if (!simulcastStarted) {
                                            simulcastStarted = true;
                                            addSimulcastButtons(temporal !== null && temporal !== undefined);
                                        }
                                        // We just received notice that there's been a switch, update the buttons
                                        updateSimulcastButtons(substream, temporal);
                                    }
                                    // Is VP9/SVC in place?
                                    var spatial = result["spatial_layer"];
                                    temporal = result["temporal_layer"];
                                    if ((spatial !== null && spatial !== undefined) || (temporal !== null && temporal !== undefined)) {
                                        if (!svcStarted) {
                                            svcStarted = true;
                                            addSvcButtons();
                                        }
                                        // We just received notice that there's been a switch, update the buttons
                                        updateSvcButtons(spatial, temporal);
                                    }
                                }
                            } else if (msg["error"] !== undefined && msg["error"] !== null) {
                                bootbox.alert(msg["error"]);
                                stopStream();
                                return;
                            }
                            if (jsep !== undefined && jsep !== null) {
                                Janus.debug("Handling SDP as well...");
                                Janus.debug(jsep);
                                // Offer from the plugin, let's answer
                                streaming.createAnswer(
                                    {
                                        jsep: jsep,
                                        // We want recvonly audio/video and, if negotiated, datachannels
                                        media: { audioSend: false, videoSend: false, data: true },
                                        success: function (jsep) {
                                            Janus.debug("Got SDP!");
                                            Janus.debug(jsep);
                                            var body = { "request": "start" };
                                            streaming.send({ "message": body, "jsep": jsep });
                                            $('#watch').html("Stop").removeAttr('disabled').click(stopStream);
                                        },
                                        error: function (error) {
                                            Janus.error("WebRTC error:", error);
                                            bootbox.alert("WebRTC error... " + JSON.stringify(error));
                                        }
                                    });
                            }
                        },
                        onremotestream: function (stream) {
                            Janus.debug(" ::: Got a remote stream :::");
                            Janus.debug(stream);
                            var addButtons = false;
                            if ($('#remotevideo').length === 0) {
                                addButtons = true;
                                $('#stream-object').html('<video class="rounded centered hide" id="remotevideo" width=960 height=540 autoplay playsinline/>');

                                // Show the stream and hide the spinner when we get a playing event
                                $("#remotevideo").bind("playing", function () {
                                    if (this.videoWidth) {
                                        $('#remotevideo').removeClass('hide').show();
                                    }

                                    if (spinner !== null && spinner !== undefined) {
                                        spinner.stop();
                                    }

                                    spinner = null;
                                    var videoTracks = stream.getVideoTracks();
                                    if (videoTracks === null || videoTracks === undefined || videoTracks.length === 0) {
                                        return;
                                    }
                                });
                            }

                            Janus.attachMediaStream($('#remotevideo').get(0), stream);
                            var videoTracks = stream.getVideoTracks();
                            if (videoTracks === null || videoTracks === undefined || videoTracks.length === 0) {
                                // No remote video
                                $('#remotevideo').hide();
                                if ($('#stream-object .no-video-container').length === 0) {
                                    $('#stream-object').html(
                                        '<div class="no-video-container">' +
                                        '<i class="fa fa-video-camera fa-5 no-video-icon"></i>' +
                                        '<span class="no-video-text">No remote video available</span>' +
                                        '</div>');
                                }
                            } else {
                                $('#stream-object .no-video-container').remove();
                                $('#remotevideo').removeClass('hide').show();
                            }
                            if (!addButtons)
                                return;
                            if (videoTracks && videoTracks.length &&
                                (Janus.webRTCAdapter.browserDetails.browser === "chrome" ||
                                    Janus.webRTCAdapter.browserDetails.browser === "firefox" ||
                                    Janus.webRTCAdapter.browserDetails.browser === "safari")) {
                                bitrateTimer = setInterval(function () {
                                    // Display updated bitrate, if supported
                                    var bitrate = streaming.getBitrate();
                                    $('#curbitrate').text(bitrate);
                                }, 1000);
                            }
                        },
                        ondataopen: function (data) {
                            Janus.log("The DataChannel is available!");
                            $('#stream-object').append(
                                '<input class="form-control" type="text" id="datarecv" disabled></input>'
                            );

                            if (spinner !== null && spinner !== undefined) {
                                spinner.stop();
                            }
                            spinner = null;
                        },
                        ondata: function (data) {
                            Janus.debug("We got data from the DataChannel! " + data);
                            $('#datarecv').val(data);
                        },
                        oncleanup: function () {
                            Janus.log(" ::: Got a cleanup notification :::");
                            $('#waitingvideo').remove();
                            $('#remotevideo').remove();
                            $('#datarecv').remove();
                            if (bitrateTimer !== null && bitrateTimer !== undefined)
                                clearInterval(bitrateTimer);
                            bitrateTimer = null;
                            simulcastStarted = false;
                        }
                    });
                },
                error: function (error) {
                    Janus.error(error);
                    alert(error);
                },
                destroyed: function () {
                    // window.location.reload();
                }
            });
        }
    });
}
