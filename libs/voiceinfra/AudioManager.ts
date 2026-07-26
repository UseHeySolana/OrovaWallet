import { MediaStream } from 'react-native-webrtc';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import {
  DeviceEventEmitter,
  PermissionsAndroid,
  Platform,
  type EmitterSubscription,
} from "react-native";
import InCallManager from "react-native-incall-manager";

// Audio output channel types
export enum AudioChannel {
  SPEAKER = "speaker",
  EARPIECE = "earpiece",
  BLUETOOTH = "bluetooth",
  WIRED_HEADSET = "wired_headset",
  AUTO = "auto",
}

// Audio device info interface
interface AudioDeviceInfo {
  name: string;
  type: string;
  ios_category?: string;
  android_audioDeviceKind?: string;
  selected?: boolean;
}

class AudioManager {
  private audioStream: MediaStream | null = null;
  private speakerMuted: boolean = false; // desired mute state (applied when stream exists or arrives)
  private currentChannel: AudioChannel = AudioChannel.SPEAKER;
  private availableChannels: AudioChannel[] = [];
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;
  private availableDevices: AudioDeviceInfo[] = [];
  private isInCallManagerActive: boolean = false;
  private stopPlaybackTimeout: ReturnType<typeof setTimeout> | null = null;
  private eventSubscriptions: EmitterSubscription[] = [];

  constructor() {
    void this.ensureInitialized();
  }

  private async chooseAudioRouteIfAvailable(route: string): Promise<void> {
    const maybeChoose = (InCallManager as any)?.chooseAudioRoute;
    if (typeof maybeChoose !== "function") {
      // Some builds of react-native-incall-manager don't expose chooseAudioRoute at runtime.
      // In that case we rely on setSpeakerphoneOn + OS automatic routing for other devices.
      return;
    }

    try {
      await maybeChoose.call(InCallManager, route);
    } catch (error) {
      console.warn("Failed to choose audio route:", route, error);
    }
  }

  /**
   * Persistently force/clear loudspeaker. Boolean false maps to "force earpiece"
   * in react-native-incall-manager; pass 0 to restore automatic external routing.
   */
  private setForceSpeakerphoneOn(flag: boolean | 0): void {
    try {
      (InCallManager as any).setForceSpeakerphoneOn(flag);
    } catch (error) {
      console.warn("Failed to set force speakerphone:", flag, error);
    }
  }

  /**
   * Ensure audio routing is ready (re-inits after session cleanup).
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    if (this.initPromise) {
      return this.initPromise;
    }
    this.initPromise = this.initializeAudioManager().finally(() => {
      this.initPromise = null;
    });
    return this.initPromise;
  }

  /**
   * Initialize the audio manager with platform-specific setup
   */
  private async initializeAudioManager(): Promise<void> {
    try {
      // Request audio permissions for WebRTC
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        console.warn("Audio permissions not granted");
        return;
      }

      // Initialize InCallManager
      await this.initializeInCallManager();

      // Platform-specific initialization
      if (Platform.OS === "ios") {
        await this.initializeIOS();
      } else {
        await this.initializeAndroid();
      }

      // Detect available audio devices
      await this.detectAvailableDevices();

      this.isInitialized = true;

      // Loudspeaker by default; BT / wired headset take priority when present
      await this.setAudioChannel(AudioChannel.AUTO);

      console.log("AudioManager initialized successfully for", Platform.OS);
    } catch (error) {
      console.error("Failed to initialize AudioManager:", error);
    }
  }

  /**
   * Initialize InCallManager for audio routing
   */
  private async initializeInCallManager(): Promise<void> {
    try {
      // Tear down any prior listeners before re-init (e.g. after session cleanup)
      this.eventSubscriptions.forEach((subscription) => subscription.remove());
      this.eventSubscriptions = [];

      // Setup InCallManager event listeners using DeviceEventEmitter
      this.eventSubscriptions.push(
        DeviceEventEmitter.addListener(
          "WiredHeadset",
          this.handleWiredHeadsetEvent.bind(this)
        )
      );
      this.eventSubscriptions.push(
        DeviceEventEmitter.addListener(
          "NoisyAudio",
          this.handleNoisyAudioEvent.bind(this)
        )
      );
      this.eventSubscriptions.push(
        DeviceEventEmitter.addListener(
          "MediaButton",
          this.handleMediaButtonEvent.bind(this)
        )
      );
      this.eventSubscriptions.push(
        DeviceEventEmitter.addListener(
          "onAudioDeviceChanged",
          this.handleAudioDeviceChangedEvent.bind(this)
        )
      );

      // Start InCallManager. media:"audio" uses VoiceChat (earpiece by default),
      // so we immediately force the loudspeaker and disable proximity earpiece routing.
      InCallManager.start({ media: "audio", auto: false, ringback: "" });
      this.isInCallManagerActive = true;
      try {
        InCallManager.stopProximitySensor();
      } catch {
        // Optional on some builds
      }
      this.setForceSpeakerphoneOn(true);
      InCallManager.setSpeakerphoneOn(true);

      console.log("InCallManager initialized successfully");
    } catch (error) {
      console.error("Failed to initialize InCallManager:", error);
    }
  }

  /**
   * iOS-specific initialization for WebRTC audio
   */
  private async initializeIOS(): Promise<void> {
    try {
      // Configure iOS audio session for WebRTC playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true, // Needed for WebRTC even if not recording
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        playsInSilentModeIOS: true, // Important for VoIP apps
        staysActiveInBackground: true, // Keep audio active in background
      });

      console.log("iOS audio session configured for WebRTC");
    } catch (error) {
      console.error("Failed to configure iOS audio session:", error);
    }
  }

  /**
   * Android-specific initialization for WebRTC audio
   */
  private async initializeAndroid(): Promise<void> {
    try {
      await this.requestAndroidBluetoothPermission();

      // Configure Android audio manager for WebRTC
      await Audio.setAudioModeAsync({
        shouldDuckAndroid: true,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: true,
      });

      console.log("Android audio manager configured for WebRTC");
    } catch (error) {
      console.error("Failed to configure Android audio manager:", error);
    }
  }

  private async requestAndroidBluetoothPermission(): Promise<void> {
    if (Platform.OS !== "android" || Platform.Version < 31) {
      return;
    }

    const permission = PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT;
    const hasPermission = await PermissionsAndroid.check(permission);
    if (hasPermission) {
      return;
    }

    const result = await PermissionsAndroid.request(permission);
    if (result !== PermissionsAndroid.RESULTS.GRANTED) {
      console.warn("Bluetooth connect permission not granted");
    }
  }

  /**
   * Event handlers for InCallManager
   */
  private handleWiredHeadsetEvent(data: any): void {
    if (!this.isInitialized) {
      return;
    }
    console.log("Wired headset event:", data);
    if (data.isPlugged) {
      this.addAvailableChannel(AudioChannel.WIRED_HEADSET);
      // Prefer wired headset when plugged in
      void this.setAudioChannel(AudioChannel.WIRED_HEADSET);
    } else {
      this.removeAvailableChannel(AudioChannel.WIRED_HEADSET);
      // Fall back to loudspeaker when unplugged
      void this.setAudioChannel(AudioChannel.SPEAKER);
    }
  }

  private handleAudioDeviceChangedEvent(data: any): void {
    if (!this.isInitialized) {
      return;
    }
    console.log("Audio device changed event:", data);
    const availableDevices = this.parseAvailableAudioDevices(
      data?.availableAudioDeviceList
    );

    if (availableDevices.length === 0) {
      return;
    }

    this.updateAvailableChannels(availableDevices);

    const hasBluetooth = availableDevices.some(
      (device) => device.type === "Bluetooth"
    );
    const hasWired = availableDevices.some(
      (device) =>
        device.type === "WiredHeadset" || device.type === "WiredHeadphones"
    );

    if (hasBluetooth && this.currentChannel !== AudioChannel.BLUETOOTH) {
      void this.setAudioChannel(AudioChannel.BLUETOOTH);
      return;
    }

    if (hasWired && this.currentChannel !== AudioChannel.WIRED_HEADSET) {
      void this.setAudioChannel(AudioChannel.WIRED_HEADSET);
      return;
    }

    // External device removed — return to loudspeaker (not earpiece)
    if (
      this.currentChannel === AudioChannel.BLUETOOTH ||
      this.currentChannel === AudioChannel.WIRED_HEADSET
    ) {
      void this.setAudioChannel(AudioChannel.AUTO);
    }
  }

  private handleNoisyAudioEvent(data: any): void {
    if (!this.isInitialized) {
      return;
    }
    console.log("Noisy audio event:", data);
    // Headphone unplug / audio route interruption — prefer loudspeaker
    void this.setAudioChannel(AudioChannel.AUTO);
  }

  private handleMediaButtonEvent(data: any): void {
    console.log("Media button event:", data);
    // Handle media button presses from headsets
  }

  /**
   * Detect available audio devices using InCallManager
   */
  private async detectAvailableDevices(): Promise<void> {
    try {
      const hadBluetoothDevice = this.isBluetoothConnected();

      // Base channels available on all devices
      this.availableChannels = [AudioChannel.SPEAKER, AudioChannel.EARPIECE];
      this.availableDevices = [];

      const wiredHeadset = await InCallManager.getIsWiredHeadsetPluggedIn();
      if (wiredHeadset?.isWiredHeadsetPluggedIn) {
        this.availableDevices.push({
          name: "WIRED_HEADSET",
          type: "WiredHeadset",
        });
        this.addAvailableChannel(AudioChannel.WIRED_HEADSET);
      }

      // iOS Bluetooth availability is reported by our native route-change event.
      if (Platform.OS === "ios" && hadBluetoothDevice) {
        this.availableDevices.push({
          name: "BLUETOOTH",
          type: "Bluetooth",
        });
        this.addAvailableChannel(AudioChannel.BLUETOOTH);
      }

      console.log("Available audio channels:", this.availableChannels);
    } catch (error) {
      console.error("Failed to detect audio devices:", error);
      // Fallback to basic channels
      this.availableChannels = [AudioChannel.SPEAKER, AudioChannel.EARPIECE];
    }
  }

  private parseAvailableAudioDevices(value: unknown): AudioDeviceInfo[] {
    if (typeof value !== "string") {
      return [];
    }

    try {
      const devices = JSON.parse(value);
      if (!Array.isArray(devices)) {
        return [];
      }

      return devices
        .filter((device): device is string => typeof device === "string")
        .map((device) => {
          switch (device) {
            case "BLUETOOTH":
              return { name: device, type: "Bluetooth" };
            case "WIRED_HEADSET":
              return { name: device, type: "WiredHeadset" };
            case "SPEAKER_PHONE":
              return { name: device, type: "Speaker" };
            case "EARPIECE":
              return { name: device, type: "Earpiece" };
            default:
              return { name: device, type: device };
          }
        });
    } catch (error) {
      console.warn("Failed to parse audio device list:", value, error);
      return [];
    }
  }

  /**
   * Update available channels based on detected devices
   */
  private updateAvailableChannels(devices: AudioDeviceInfo[]): void {
    this.availableChannels = [AudioChannel.SPEAKER, AudioChannel.EARPIECE];
    this.availableDevices = devices;

    devices.forEach((device) => {
      if (
        device.type === "Bluetooth" ||
        device.type === "BluetoothA2DP" ||
        device.type === "BluetoothSCO"
      ) {
        this.addAvailableChannel(AudioChannel.BLUETOOTH);
      } else if (
        device.type === "WiredHeadset" ||
        device.type === "WiredHeadphones"
      ) {
        this.addAvailableChannel(AudioChannel.WIRED_HEADSET);
      }
    });

    console.log("Updated available channels:", this.availableChannels);
  }

  /**
   * Add a channel to available channels if not already present
   */
  private addAvailableChannel(channel: AudioChannel): void {
    if (!this.availableChannels.includes(channel)) {
      this.availableChannels.push(channel);
    }
  }

  /**
   * Remove a channel from available channels
   */
  private removeAvailableChannel(channel: AudioChannel): void {
    this.availableChannels = this.availableChannels.filter(
      (ch) => ch !== channel
    );
  }

  /**
   * Set the audio output channel using InCallManager
   */
  async setAudioChannel(channel: AudioChannel): Promise<void> {
    await this.ensureInitialized();
    if (!this.isInitialized) {
      console.warn("AudioManager not initialized yet");
      return;
    }

    try {
      // Handle auto channel selection
      if (channel === AudioChannel.AUTO) {
        channel = this.selectBestChannel();
      }

      // Validate channel availability
      if (!this.availableChannels.includes(channel)) {
        console.warn(
          `Channel ${channel} not available, falling back to speaker`
        );
        channel = AudioChannel.SPEAKER;
      }

      // Route audio using InCallManager
      await this.routeAudioWithInCallManager(channel);

      this.currentChannel = channel;
      console.log(`Audio channel set to: ${channel} on ${Platform.OS}`);

      // Re-apply platform audio mode without dropping the chosen route
      if (this.audioStream) {
        await this.applyPlatformAudioMode();
        await this.routeAudioWithInCallManager(this.currentChannel);
      }
    } catch (error) {
      console.error(`Failed to set audio channel to ${channel}:`, error);
    }
  }

  /**
   * Route audio using InCallManager based on channel
   */
  private async routeAudioWithInCallManager(
    channel: AudioChannel
  ): Promise<void> {
    try {
      switch (channel) {
        case AudioChannel.SPEAKER:
          // Persist loudspeaker across WebRTC / route-change resets
          this.setForceSpeakerphoneOn(true);
          InCallManager.setSpeakerphoneOn(true);
          await this.chooseAudioRouteIfAvailable("SPEAKER_PHONE");
          break;

        case AudioChannel.EARPIECE:
          this.setForceSpeakerphoneOn(false);
          InCallManager.setSpeakerphoneOn(false);
          await this.chooseAudioRouteIfAvailable("EARPIECE");
          break;

        case AudioChannel.BLUETOOTH:
          // Clear forced speaker so the OS can use Bluetooth
          this.setForceSpeakerphoneOn(0);
          InCallManager.setSpeakerphoneOn(false);
          await this.chooseAudioRouteIfAvailable("BLUETOOTH");
          break;

        case AudioChannel.WIRED_HEADSET:
          this.setForceSpeakerphoneOn(0);
          InCallManager.setSpeakerphoneOn(false);
          await this.chooseAudioRouteIfAvailable("WIRED_HEADSET");
          break;

        default:
          console.warn(`Unknown channel: ${channel}`);
          break;
      }

      console.log(`InCallManager audio routed to ${channel}`);
    } catch (error) {
      console.error("Error routing audio with InCallManager:", error);
    }
  }

  /**
   * Select the best available audio channel with priority for external devices.
   * Built-in earpiece is never auto-selected — loudspeaker is the default.
   */
  private selectBestChannel(): AudioChannel {
    const priorityOrder = [
      AudioChannel.BLUETOOTH,
      AudioChannel.WIRED_HEADSET,
      AudioChannel.SPEAKER,
    ];

    for (const channel of priorityOrder) {
      if (this.availableChannels.includes(channel)) {
        return channel;
      }
    }

    return AudioChannel.SPEAKER;
  }

  /**
   * Get available audio devices
   */
  async getAvailableDevices(): Promise<AudioDeviceInfo[]> {
    try {
      // Return the current available devices
      return this.availableDevices;
    } catch (error) {
      console.error("Failed to get audio devices:", error);
      return [];
    }
  }

  /**
   * Check if Bluetooth device is connected
   */
  isBluetoothConnected(): boolean {
    return this.availableDevices.some(
      (device) =>
        device.type === "Bluetooth" ||
        device.type === "BluetoothA2DP" ||
        device.type === "BluetoothSCO"
    );
  }

  /**
   * Check if wired headset is connected
   */
  isWiredHeadsetConnected(): boolean {
    return this.availableDevices.some(
      (device) =>
        device.type === "WiredHeadset" || device.type === "WiredHeadphones"
    );
  }

  /**
   * Force refresh of available devices
   */
  async refreshAvailableDevices(): Promise<void> {
    await this.detectAvailableDevices();
  }

  /**
   * Apply current speaker mute state to the remote stream (volume to 0 when muted).
   * Uses native _setVolume(0) when available for reliable mute; falls back to track.enabled.
   */
  private applySpeakerMute(): void {
    if (!this.audioStream) return;
    const audioTracks = this.audioStream.getAudioTracks();
    audioTracks.forEach((track: any) => {
      if (typeof track._setVolume === "function") {
        track._setVolume(this.speakerMuted ? 0 : 1);
      } else {
        track.enabled = !this.speakerMuted;
      }
    });
  }

  /**
   * Handle incoming remote audio stream from WebRTC
   */
  async handleRemoteStream(stream: MediaStream): Promise<void> {
    console.log("Received remote WebRTC audio stream");
    await this.ensureInitialized();
    this.audioStream = stream;
    this.applySpeakerMute(); // apply any mute user set before stream arrived
    await this.routeWebRTCAudio();
  }

  private async applyPlatformAudioMode(): Promise<void> {
    if (Platform.OS === "ios") {
      await this.initializeIOS();
    } else {
      await this.initializeAndroid();
    }
  }

  /**
   * Route WebRTC audio through the current channel
   */
  private async routeWebRTCAudio(): Promise<void> {
    if (!this.audioStream) {
      console.error("No WebRTC audio stream available");
      return;
    }

    try {
      // expo-av PlayAndRecord can reset to earpiece — re-apply loudspeaker after
      await this.applyPlatformAudioMode();
      await this.routeAudioWithInCallManager(
        this.currentChannel === AudioChannel.AUTO
          ? this.selectBestChannel()
          : this.currentChannel
      );

      console.log(
        `WebRTC audio routed through ${this.currentChannel} on ${Platform.OS}`
      );
    } catch (error) {
      console.error("Error routing WebRTC audio:", error);
    }
  }

  /**
   * Toggle between speaker and earpiece (legacy method for WebRTC)
   */
  async toggleSpeaker(speakerOn: boolean): Promise<void> {
    if (speakerOn) {
      await this.setAudioChannel(AudioChannel.AUTO);
      return;
    }
    await this.setAudioChannel(AudioChannel.EARPIECE);
  }

  /**
   * Cycle through available audio channels for WebRTC
   */
  async cycleAudioChannel(): Promise<void> {
    const currentIndex = this.availableChannels.indexOf(this.currentChannel);
    const nextIndex = (currentIndex + 1) % this.availableChannels.length;
    const nextChannel = this.availableChannels[nextIndex];

    await this.setAudioChannel(nextChannel);
  }

  /**
   * Get current audio channel
   */
  getCurrentChannel(): AudioChannel {
    return this.currentChannel;
  }

  /**
   * Get available audio channels
   */
  getAvailableChannels(): AudioChannel[] {
    return [...this.availableChannels];
  }

  /**
   * Get current platform
   */
  getPlatform(): string {
    return Platform.OS;
  }

  /**
   * Check if current platform supports specific channel
   */
  isChannelSupported(channel: AudioChannel): boolean {
    return this.availableChannels.includes(channel);
  }

  /**
   * Get platform-specific channel limitations for WebRTC
   */
  getChannelLimitations(): string[] {
    const limitations: string[] = [];

    if (Platform.OS === "ios") {
      limitations.push(
        "iOS earpiece routing for WebRTC requires native module"
      );
      limitations.push(
        "iOS Bluetooth routing is automatic when device is paired"
      );
      limitations.push("iOS audio session management affects WebRTC streams");
    } else {
      limitations.push("Android audio focus may affect WebRTC audio quality");
      limitations.push(
        "Android Bluetooth routing may require additional permissions"
      );
    }

    return limitations;
  }

  /**
   * Check if WebRTC stream is currently active
   */
  isStreamActive(): boolean {
    return this.audioStream !== null;
  }

  /**
   * Get WebRTC stream info
   */
  getStreamInfo(): { hasAudio: boolean; trackCount: number } | null {
    if (!this.audioStream) {
      return null;
    }

    const audioTracks = this.audioStream.getAudioTracks();
    return {
      hasAudio: audioTracks.length > 0,
      trackCount: audioTracks.length,
    };
  }

  /**
   * Mute/unmute WebRTC audio stream (volume to 0 when muted).
   * Stores desired state so it applies when the remote stream arrives if it's not here yet.
   */
  muteAudio(muted: boolean): void {
    this.speakerMuted = muted;
    if (!this.audioStream) {
      return; // will apply in handleRemoteStream when stream arrives
    }
    this.applySpeakerMute();
    console.log(`WebRTC audio ${muted ? "muted" : "unmuted"}`);
  }

  /**
   * Immediately silence any currently-playing remote WebRTC audio.
   * This is used to cut off buffered playback during interruptions/cancellations.
   *
   * It does NOT tear down the stream or change the user's desired mute state.
   */
  stopPlayback(durationMs: number = 350): void {
    if (!this.audioStream) return;

    // Ensure rapid consecutive calls keep playback silenced.
    if (this.stopPlaybackTimeout) {
      clearTimeout(this.stopPlaybackTimeout);
      this.stopPlaybackTimeout = null;
    }

    const audioTracks = this.audioStream.getAudioTracks();
    audioTracks.forEach((track: any) => {
      if (typeof track._setVolume === "function") {
        track._setVolume(0);
      } else {
        track.enabled = false;
      }
    });

    this.stopPlaybackTimeout = setTimeout(() => {
      if (!this.audioStream) return;
      // Restore to the user's desired mute state (speakerMuted).
      this.applySpeakerMute();
      this.stopPlaybackTimeout = null;
    }, durationMs);
  }

  /**
   * Clean up WebRTC audio resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.stopPlaybackTimeout) {
        clearTimeout(this.stopPlaybackTimeout);
        this.stopPlaybackTimeout = null;
      }

      // Clean up WebRTC stream
      if (this.audioStream) {
        const tracks = this.audioStream.getTracks();
        tracks.forEach((track) => track.stop());
        this.audioStream = null;
      }

      // Stop InCallManager
      if (this.isInCallManagerActive) {
        InCallManager.stop();
        this.isInCallManagerActive = false;
      }

      // Remove event listeners
      this.eventSubscriptions.forEach((subscription) =>
        subscription.remove()
      );
      this.eventSubscriptions = [];

      // Reset to platform-appropriate defaults
      const defaultConfig =
        Platform.OS === "ios"
          ? {
              allowsRecordingIOS: false,
              interruptionModeIOS: InterruptionModeIOS.DoNotMix,
              playsInSilentModeIOS: true,
              staysActiveInBackground: false,
            }
          : {
              shouldDuckAndroid: false,
              interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
              playThroughEarpieceAndroid: false,
              staysActiveInBackground: false,
            };

      await Audio.setAudioModeAsync(defaultConfig);

      this.isInitialized = false;
      console.log(
        `WebRTC AudioManager cleaned up successfully on ${Platform.OS}`
      );
    } catch (error) {
      console.error("Error during WebRTC AudioManager cleanup:", error);
    }
  }
}

export default AudioManager;