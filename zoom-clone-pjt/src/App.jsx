// src/App.jsx
import React, { useState, useEffect, useRef } from 'react';
import './App.css'; // 필요한 CSS를 import합니다.

function App() {
  const [roomName, setRoomName] = useState('');
  const [isCallVisible, setIsCallVisible] = useState(false);
  const [myStream, setMyStream] = useState(null);
  const [myPeerConnection, setMyPeerConnection] = useState(null);
  const [myDataChannel, setMyDataChannel] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  const myFaceRef = useRef(null);
  const peerFaceRef = useRef(null);
  const camerasSelectRef = useRef(null);

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:3000');

    socket.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'welcome':
          const dataChannel = myPeerConnection.createDataChannel('chat');
          dataChannel.onmessage = (event) => console.log(event.data);
          setMyDataChannel(dataChannel);
          const offer = await myPeerConnection.createOffer();
          await myPeerConnection.setLocalDescription(offer);
          socket.send(JSON.stringify({ type: 'offer', offer, roomName }));
          break;
        case 'offer':
          myPeerConnection.ondatachannel = (event) => {
            const dataChannel = event.channel;
            dataChannel.onmessage = (event) => console.log(event.data);
            setMyDataChannel(dataChannel);
          };
          await myPeerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await myPeerConnection.createAnswer();
          await myPeerConnection.setLocalDescription(answer);
          socket.send(JSON.stringify({ type: 'answer', answer, roomName }));
          break;
        case 'answer':
          await myPeerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
          break;
        case 'ice':
          await myPeerConnection.addIceCandidate(new RTCIceCandidate(data.ice));
          break;
        default:
          break;
      }
    };

    const handleJoinRoom = async () => {
      setIsCallVisible(true);
      await getMedia();
      makeConnection();
      socket.send(JSON.stringify({ type: 'join_room', roomName }));
    };

    const getMedia = async (deviceId) => {
      const constraints = deviceId
        ? { audio: true, video: { deviceId: { exact: deviceId } } }
        : { audio: true, video: true };
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        setMyStream(stream);
        if (myFaceRef.current) {
          myFaceRef.current.srcObject = stream;
        }
        if (!deviceId) {
          await getCameras();
        }
      } catch (err) {
        console.error(err);
      }
    };

    const getCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setCameras(videoDevices);
        if (videoDevices.length > 0) {
          camerasSelectRef.current.value = videoDevices[0].deviceId;
        }
      } catch (err) {
        console.error(err);
      }
    };

    const makeConnection = () => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.send(JSON.stringify({ type: 'ice', ice: event.candidate, roomName }));
        }
      };

      pc.ontrack = (event) => {
        if (peerFaceRef.current) {
          peerFaceRef.current.srcObject = event.streams[0];
        }
      };

      myStream.getTracks().forEach(track => pc.addTrack(track, myStream));
      setMyPeerConnection(pc);
    };

    const handleMute = () => {
      myStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
      setMuted(!muted);
    };

    const handleCamera = () => {
      myStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
      setCameraOff(!cameraOff);
    };

    const handleCameraChange = async () => {
      await getMedia(camerasSelectRef.current.value);
      if (myPeerConnection) {
        const videoTrack = myStream.getVideoTracks()[0];
        const videoSender = myPeerConnection.getSenders().find(sender => sender.track.kind === 'video');
        videoSender.replaceTrack(videoTrack);
      }
    };

    return (
      <div>
        {!isCallVisible ? (
          <div id="welcome">
            <form onSubmit={e => { e.preventDefault(); handleJoinRoom(); }}>
              <input
                type="text"
                placeholder="방 코드 입력"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                required
              />
              <button type="submit">Join Room</button>
            </form>
          </div>
        ) : (
          <div id="call">
            <div id="myStream">
              <video ref={myFaceRef} autoPlay playsInline width="400" height="400" />
              <button onClick={handleMute}>{muted ? 'Unmute' : 'Mute'}</button>
              <button onClick={handleCamera}>{cameraOff ? 'Turn Camera On' : 'Turn Camera Off'}</button>
              <select ref={camerasSelectRef} onChange={handleCameraChange}>
                {cameras.map(camera => (
                  <option key={camera.deviceId} value={camera.deviceId}>{camera.label}</option>
                ))}
              </select>
              <video ref={peerFaceRef} autoPlay playsInline width="400" height="400" />
            </div>
          </div>
        )}
      </div>
    );
  }
)
}

export default App;
