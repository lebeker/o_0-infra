export type WebRtcEvents = 'message' | 'connectionstatechanged' | 'iceconnectionstatechange' | 'anystatechanged';

export const WEBRTC_ICE_STATE_CHANGED: WebRtcEvents = 'iceconnectionstatechange';
export const WEBRTC_CONNECTION_STATE_CHANGED: WebRtcEvents = 'connectionstatechanged';

export const WEBRTC_STATE_CHANGED: WebRtcEvents = 'anystatechanged';
export const WEBRTC_MESSAGE: WebRtcEvents = 'message';

class WebRtcIo {
  private peerConnection?: RTCPeerConnection;
  private dataChannel?: RTCDataChannel;
  private connections?: any[];
  private subscriptions: {[key in WebRtcEvents]: Array<(e: any) => void>} = {} as {[key in WebRtcEvents]: Array<(e: Event) => void>};

  constructor(
    private channelName = 'chat'
  ) {
    this.reconnect();
  }

  subscribe(eventType: WebRtcEvents, callback: (e: Event) => void) {
    this.subscriptions[eventType] = this.subscriptions[eventType] || [];
    this.subscriptions[eventType].push(callback);
  }

  get state(): null | [RTCIceConnectionState, RTCSignalingState,  RTCDataChannelState] {
    return this.peerConnection && this.dataChannel ? [
      this.peerConnection.iceConnectionState,
      this.peerConnection.signalingState,
      this.dataChannel.readyState,
    ] : null;
  }

  private onAnyStateChanged(e: Event) {
    for (let cb of this.subscriptions[WEBRTC_STATE_CHANGED] || []) cb(e);
  }

  reconnect() {
    if (!this.peerConnection || this.peerConnection.signalingState === 'closed') {
console.log('CREATE CONNECTION');
      this.peerConnection = new RTCPeerConnection();//{ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

      // If it's slave
      this.peerConnection.ondatachannel = (event) => {
console.log('U ARE ENSLAVED! (or U ARE a PARAZITE ¯\_(ツ)_/¯) = ondatachannel');
        this.dataChannel = event.channel;
        // channel.onopen = event => console.log('onopen', event);
        // channel.onmessage = event => console.log('onmessage', event);
        this.dataChannel.onopen = (e) => {
          this.onOpen();
          this.onAnyStateChanged(e);
        }
        this.dataChannel.onmessage = (e) => this.onMessage(e);
      }
      //this.dataChannel = this.peerConnection.createDataChannel(this.channelName);
      //this.dataChannel.onopen = () => this.onOpen();
      //this.dataChannel.onmessage = (e) => this.onMessage(e);
  
      this.peerConnection.onicecandidate = (e) => this.onIceCandidate(e);
      
      this.peerConnection.onconnectionstatechange = (e) => {
        this.onAnyStateChanged(e);
        console.log("Connection Status changed to: ", this.peerConnection?.signalingState);
        console.log('chanell status:', this.dataChannel?.readyState);
      };
      this.peerConnection.oniceconnectionstatechange = (e) =>
        this.onAnyStateChanged(e);
    }
console.log('connection status:', this.peerConnection?.signalingState);
console.log('chanell status:', this.dataChannel?.readyState);
    return this;
  }

  onOpen() {
    console.log('RTCP datachannel is open!');
    this.sendMessage('Hey-ho!');
  }

  onMessage(event: MessageEvent) {
    console.log('Received message:', event.data);
  };

  sendMessage(data: string) {
    this.dataChannel?.send(data);
console.log("MSG:", data);
    for (let cb of this.subscriptions[WEBRTC_MESSAGE] || []) cb(data);
  }

  onIceCandidate(event: RTCPeerConnectionIceEvent) {
console.log("Ice Candidate:", event.candidate);
    if (event.candidate) {
      this.sendIceCandidateToPeer(event.candidate);
    }
  }

  // set up offer for peer connection
  async createOffer(): Promise<string> {
    if (!this.peerConnection)
      throw new Error("Can't create an Offer: PeerConnection is undefined");
    this.dataChannel = this.peerConnection.createDataChannel(this.channelName);
    if (!this.dataChannel)
      throw new Error("Can't create an Offer: DataChannel creation failed");

    this.dataChannel.onmessage = (e) => this.onMessage(e);

    const offerFromIce = new Promise((resolve) => this.peerConnection
      ? this.peerConnection.onicecandidate = (e) => {
          if (!e.candidate) resolve(this.peerConnection?.localDescription);
        }
      : null);

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    
console.log("offer-descr", this.peerConnection.localDescription);
console.log("offer-offer", offer);
console.log("offer-ice-offer", await offerFromIce);
    return btoa(JSON.stringify(await offerFromIce));
  }

  async createAnswer(): Promise<string> {
    const answerFromIce = new Promise(resolve => this.peerConnection.onicecandidate = (e) => {
      if (!e.candidate) {
        resolve(this.peerConnection.localDescription);
      }
    });

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

console.log("answer-descr",this.peerConnection.localDescription);
console.log("answer-answr", answer);
console.log("answer-ice-answr", await answerFromIce);
    return btoa(JSON.stringify(await answerFromIce));
  }

  // receive offer from peer
  async acceptOffer(offerStr: string): Promise<string> {
    const offer: RTCSessionDescriptionInit = JSON.parse(atob(offerStr));
    await this.peerConnection.setRemoteDescription(offer);
    
    return await this.createAnswer();
  }

  // receive answer from peer
  async acceptAnswer(answerStr: string) {
    const answer: RTCSessionDescriptionInit = JSON.parse(atob(answerStr));
    await this.peerConnection.setRemoteDescription(answer);
  }

  // send ice candidate to peer
  sendIceCandidateToPeer(candidate: RTCIceCandidate) {
console.log('send ice candidate to peer?', candidate);
    // send candidate over signaling channel to peer
  }
}
export const WebRTC = new WebRtcIo();
