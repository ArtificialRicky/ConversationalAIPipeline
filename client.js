var pc = null;
var dc = null, dcInterval = null;

function createPeerConnection() {
    var config = {
        sdpSemantics: 'unified-plan'
    };

    pc = new RTCPeerConnection(config);

    // register some listeners to help debugging
    pc.addEventListener('icegatheringstatechange', function() {
        console.log('ice gathering state change: ' + pc.iceGatheringState);
    }, false);

    pc.addEventListener('iceconnectionstatechange', function() {
        console.log('ice connection state change: ' + pc.iceConnectionState);
    }, false);

    pc.addEventListener('signalingstatechange', function() {
        console.log('signaling state change: ' + pc.signalingState);
    }, false);

    // connect data channel
    pc.addEventListener('datachannel', function(evt) {
        dc = evt.channel;
        dc.onopen = function() {
            console.log('data channel open');
            dcInterval = setInterval(function() {
                var message = 'ping ' + current_stamp();
                dc.send(message);
            }, 1000);
        };
        dc.onmessage = function(evt) {
            console.log('received: ' + evt.data);
        };
        dc.onclose = function() {
            console.log('data channel close');
            clearInterval(dcInterval);
        };
    });
    return pc;
}

function negotiate() {
    return pc.createOffer().then(function(offer) {
        return pc.setLocalDescription(offer);
    }).then(function() {
        // wait for ICE gathering to complete
        return new Promise(function(resolve) {
            if (pc.iceGatheringState === 'complete') {
                resolve();
            } else {
                function checkState() {
                    if (pc.iceGatheringState === 'complete') {
                        pc.removeEventListener('icegatheringstatechange', checkState);
                        resolve();
                    }
                }
                pc.addEventListener('icegatheringstatechange', checkState);
            }
        });
    }).then(function() {
        var offer = pc.localDescription;
        return fetch('/offer', {
            body: JSON.stringify({
                sdp: offer.sdp,
                type: offer.type,
            }),
            headers: {
                'Content-Type': 'application/json'
            },
            method: 'POST'
        });
    }).then(function(response) {
        return response.json();
    }).then(function(answer) {
        return pc.setRemoteDescription(answer);
    }).catch(function(e) {
        alert(e);
    });
}

function start() {
    pc = createPeerConnection();
    negotiate();
}

function stop() {
    // close data channel
    if (dc) {
        dc.close();
    }

    // close transceivers
    if (pc.getTransceivers) {
        pc.getTransceivers().forEach(function(transceiver) {
            if (transceiver.stop) {
                transceiver.stop();
            }
        });
    }

    // close peer connection
    setTimeout(function() {
        pc.close();
    }, 500);
}

function current_stamp() {
    if (window.performance && window.performance.now) {
        return window.performance.now();
    } else {
        return new Date().getTime();
    }
} 