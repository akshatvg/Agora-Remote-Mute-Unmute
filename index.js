// Create Agora RTC client
var client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
// RTM Global Vars
var isLoggedIn = false;
// Local Tracks
var localTracks = {
    videoTrack: null,
    audioTrack: null
};
var remoteUsers = {};
// Agora client options
var options = {
    appid: null,
    channel: null,
    uid: null,
    token: null,
    accountName: null
};

// Join Channel
$("#join-form").submit(async function (e) {
    e.preventDefault();
    enableUiControls();
    $("#join").attr("disabled", true);
    try {
        options.appid = $("#appid").val();
        options.token = $("#token").val();
        options.channel = $("#channel").val();
        options.accountName = $('#accountName').val();
        await join();
    } catch (error) {
        console.error(error);
    } finally {
        $("#leave").attr("disabled", false);
    }
})

// Leave Channel
$("#leave").click(function (e) {
    leave();
})

// Join Function
async function join() {
    // Add event listener to play remote tracks when remote user publishes
    client.on("user-published", handleUserPublished);
    client.on("user-unpublished", handleUserUnpublished);
    // Join a channel and create local tracks, we can use Promise.all to run them concurrently
    [options.uid, localTracks.audioTrack, localTracks.videoTrack] = await Promise.all([
        // Join the channel
        client.join(options.appid, options.channel, options.token || null),
        // Create local tracks, using microphone and camera
        AgoraRTC.createMicrophoneAudioTrack(),
        AgoraRTC.createCameraVideoTrack()
    ]);
    // Play local video track
    localTracks.videoTrack.play("local-player");
    $("#local-player-name").text(`localVideo(${options.uid})`);
    // Publish local tracks to channel
    await client.publish(Object.values(localTracks));
    console.log("Publish success");
    $("#mic-btn").prop("disabled", false);
    $("#video-btn").prop("disabled", false);
    // Create Agora RTM client
    const clientRTM = AgoraRTM.createInstance($("#appid").val(), { enableLogUpload: false });
    var accountName = $('#accountName').val();
    // Login
    clientRTM.login({ uid: accountName }).then(() => {
        console.log('AgoraRTM client login success. Username: ' + accountName);
        isLoggedIn = true;
        // RTM Channel Join
        var channelName = $('#channel').val();
        channel = clientRTM.createChannel(channelName);
        channel.join().then(() => {
            console.log('AgoraRTM client channel join success.');
            // Get all members in RTM Channel
            channel.getMembers().then((memberNames) => {
                console.log("------------------------------");
                console.log("All members in the channel are as follows: ");
                console.log(memberNames);
                var newHTML = $.map(memberNames, function (singleMember) {
                    return (`<li class="mt-2">
                    <div class="row">
                        <p>${singleMember}</p>
                    </div>
                    <div class="mb-4">
                        <a href="#!"><i class="fa text-white fa-microphone mx-3 remoteMicrophone" id="remoteAudio-${singleMember}"></i></a>
                        <a href="#!"><i class="fa text-white fa-video remoteCamera" id="remoteVideo-${singleMember}"></i></a>
                    </div>
                 </li>`);
                });
                $("#insert-all-users").html(newHTML.join(""));
            });
            // Receive RTM Channel Message
            channel.on('ChannelMessage', ({ text }, senderId) => {
                console.log("Message received successfully.");
                console.log("The message is: " + text + " by " + senderId);
                $("#actual-text").append("<br> <b>Speaker:</b> " + senderId + "<br> <b>Message:</b> " + text + "<br>");
            });
            // Display channel member joined updated users
            channel.on('MemberJoined', function () {
                // Get all members in RTM Channel
                channel.getMembers().then((memberNames) => {
                    console.log("New member joined so updated list is: ");
                    console.log(memberNames);
                    var newHTML = $.map(memberNames, function (singleMember) {
                        return (`<li class="mt-2">
        <div class="row">
            <p>${singleMember}</p>
        </div>
        <div class="mb-4">
            <a href="#!"><i class="fa text-white fa-microphone mx-3 remoteMicrophone" id="remoteAudio-${singleMember}"></i></a>
            <a href="#!"><i class="fa text-white fa-video remoteCamera" id="remoteVideo-${singleMember}"></i></a>
        </div>
     </li>`);
                    });
                    $("#insert-all-users").html(newHTML.join(""));
                });
            })
            // Display channel member left updated users
            channel.on('MemberLeft', function () {
                // Get all members in RTM Channel
                channel.getMembers().then((memberNames) => {
                    console.log("A member left so updated list is: ");
                    console.log(memberNames);
                    var newHTML = $.map(memberNames, function (singleMember) {
                        return (`<li class="mt-2">
            <div class="row">
                <p>${singleMember}</p>
            </div>
            <div class="mb-4">
                <a href="#!"><i class="fa text-white fa-microphone mx-3 remoteMicrophone" id="remoteAudio-${singleMember}"></i></a>
                <a href="#!"><i class="fa text-white fa-video remoteCamera" id="remoteVideo-${singleMember}"></i></a>
            </div>
         </li>`);
                    });
                    $("#insert-all-users").html(newHTML.join(""));
                });
            })
        }).catch(error => {
            console.log('AgoraRTM client channel join failed: ', error);
        }).catch(err => {
            console.log('AgoraRTM client login failure: ', err);
        });
    });
    document.getElementById("leave").onclick = async function () {
        console.log("Client logged out of RTM.");
        await clientRTM.logout();
    }
}

// Leave Function
async function leave() {
    for (trackName in localTracks) {
        var track = localTracks[trackName];
        if (track) {
            track.stop();
            track.close();
            localTracks[trackName] = undefined;
        }
    }

    // Remove remote users and player views
    remoteUsers = {};
    $("#remote-playerlist").html("");

    // Leave the channel
    await client.leave();
    $("#local-player-name").text("");
    $("#join").attr("disabled", false);
    $("#leave").attr("disabled", true);
    $("#mic-btn").prop("disabled", true);
    $("#video-btn").prop("disabled", true);
    console.log("Client leaves channel success");
    $("#insert-all-users").html(``);
}

// Subscribe function
async function subscribe(user, mediaType) {
    const uid = user.uid;
    // Subscribe to a remote user
    await client.subscribe(user, mediaType);
    console.log("Subscribe success");
    if (mediaType === 'video') {
        const player = $(`
      <div id="player-wrapper-${uid}">
        <p class="player-name">remoteUser(${uid})</p>
        <div id="player-${uid}" class="player"></div>
      </div>
    `);
        $("#remote-playerlist").append(player);
        user.videoTrack.play(`player-${uid}`);
    }
    if (mediaType === 'audio') {
        user.audioTrack.play();
    }
}

// User published callback
function handleUserPublished(user, mediaType) {
    const id = user.uid;
    remoteUsers[id] = user;
    subscribe(user, mediaType);
}

// User unpublish callback
function handleUserUnpublished(user) {
    const id = user.uid;
    delete remoteUsers[id];
    $(`#player-wrapper-${id}`).remove();
}

// Action buttons
function enableUiControls() {
    $("#mic-btn").click(function () {
        toggleMic();
    });
    $("#video-btn").click(function () {
        toggleVideo();
    });
}

// Toggle Mic
function toggleMic() {
    if ($("#mic-icon").hasClass('fa-microphone')) {
        localTracks.audioTrack.setEnabled(false);
        console.log("Audio Muted.");
    } else {
        localTracks.audioTrack.setEnabled(true);
        console.log("Audio Unmuted.");
    }
    $("#mic-icon").toggleClass('fa-microphone').toggleClass('fa-microphone-slash');
}

// Toggle Video
function toggleVideo() {
    if ($("#video-icon").hasClass('fa-video')) {
        localTracks.videoTrack.setEnabled(false);
        console.log("Video Muted.");
    } else {
        localTracks.videoTrack.setEnabled(true);
        console.log("Video Unmuted.");
    }
    $("#video-icon").toggleClass('fa-video').toggleClass('fa-video-slash');
}