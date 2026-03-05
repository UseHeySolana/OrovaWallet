import { MediaStream } from 'react-native-webrtc';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import { Platform } from "react-native";
import InCallManager from "react-native-incall-manager";

// Audio output channel types
export enum AudioChannel {
  SPEAKER = "speaker",
  EARPIECE = "earpiece",
  BLUETOOTH = "bluetooth",
  WIRED_HEADSET = "wired_headset",
  AUTO = "auto",
}

// Audio mode configuration interface
interface AudioModeConfig {
  // iOS-specific settings
  allowsRecordingIOS?: boolean;
  interruptionModeIOS?: number;
  playsInSilentModeIOS?: boolean;
  staysActiveInBackground?: boolean;
  // Android-specific settings
  shouldDuckAndroid?: boolean;
  interruptionModeAndroid?: number;
  playThroughEarpieceAndroid?: boolean;
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
  private availableDevices: AudioDeviceInfo[] = [];
  private isInCallManagerActive: boolean = false;

  constructor() {
    this.initializeAudioManager();
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

      // Set initial audio mode
      await this.setAudioChannel(AudioChannel.AUTO);

      this.isInitialized = true;
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
      // Import DeviceEventEmitter for event handling
      const { DeviceEventEmitter } = require("react-native");

      // Setup InCallManager event listeners using DeviceEventEmitter
      DeviceEventEmitter.addListener(
        "WiredHeadset",
        this.handleWiredHeadsetEvent.bind(this)
      );
      DeviceEventEmitter.addListener(
        "Proximity",
        this.handleProximityEvent.bind(this)
      );
      DeviceEventEmitter.addListener(
        "NoisyAudio",
        this.handleNoisyAudioEvent.bind(this)
      );
      DeviceEventEmitter.addListener(
        "MediaButton",
        this.handleMediaButtonEvent.bind(this)
      );

      // Start InCallManager
      InCallManager.start({ media: "audio", auto: false, ringback: "" });
      this.isInCallManagerActive = true;

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

  /**
   * Event handlers for InCallManager
   */
  private handleWiredHeadsetEvent(data: any): void {
    console.log("Wired headset event:", data);
    if (data.isPlugged) {
      this.addAvailableChannel(AudioChannel.WIRED_HEADSET);
      // Auto-route to wired headset when plugged in
      this.setAudioChannel(AudioChannel.WIRED_HEADSET);
    } else {
      this.removeAvailableChannel(AudioChannel.WIRED_HEADSET);
      // Fall back to speaker when unplugged
      this.setAudioChannel(AudioChannel.SPEAKER);
    }
  }

  private handleNoisyAudioEvent(data: any): void {
    console.log("Noisy audio event:", data);
    // Handle audio interruption (e.g., headphone unplugged)
  }

  private handleMediaButtonEvent(data: any): void {
    console.log("Media button event:", data);
    // Handle media button presses from headsets
  }

  private handleProximityEvent(data: any): void {
    console.log("Proximity event:", data);
    // Handle proximity sensor changes
    if (data.isNear && this.currentChannel === AudioChannel.SPEAKER) {
      this.setAudioChannel(AudioChannel.EARPIECE);
    }
  }

  /**
   * Detect available audio devices using InCallManager
   */
  private async detectAvailableDevices(): Promise<void> {
    try {
      // Base channels available on all devices
      this.availableChannels = [AudioChannel.SPEAKER, AudioChannel.EARPIECE];

      // Check for Bluetooth connectivity
      const isBluetoothAvailable =
        await InCallManager.getIsWiredHeadsetPluggedIn();

      // For now, assume basic device availability
      // In a real implementation, you would check actual device connectivity
      this.availableChannels.push(
        AudioChannel.BLUETOOTH,
        AudioChannel.WIRED_HEADSET
      );

      console.log("Available audio channels:", this.availableChannels);
    } catch (error) {
      console.error("Failed to detect audio devices:", error);
      // Fallback to basic channels
      this.availableChannels = [AudioChannel.SPEAKER, AudioChannel.EARPIECE];
    }
  }

  /**
   * Update available channels based on detected devices
   */
  private updateAvailableChannels(devices: AudioDeviceInfo[]): void {
    this.availableChannels = [AudioChannel.SPEAKER, AudioChannel.EARPIECE];

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

      // Re-route existing WebRTC audio if available
      if (this.audioStream) {
        await this.routeWebRTCAudio();
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
          InCallManager.setSpeakerphoneOn(true);
          InCallManager.chooseAudioRoute("SPEAKER");
          break;

        case AudioChannel.EARPIECE:
          InCallManager.setSpeakerphoneOn(false);
          InCallManager.chooseAudioRoute("EARPIECE");
          break;

        case AudioChannel.BLUETOOTH:
          InCallManager.setSpeakerphoneOn(false);
          // Find and select Bluetooth device
          const bluetoothDevice = this.availableDevices.find(
            (device) =>
              device.type === "Bluetooth" ||
              device.type === "BluetoothA2DP" ||
              device.type === "BluetoothSCO"
          );
          if (bluetoothDevice) {
            InCallManager.chooseAudioRoute(bluetoothDevice.name);
          }
          break;

        case AudioChannel.WIRED_HEADSET:
          InCallManager.setSpeakerphoneOn(false);
          // Find and select wired headset device
          const wiredDevice = this.availableDevices.find(
            (device) =>
              device.type === "WiredHeadset" ||
              device.type === "WiredHeadphones"
          );
          if (wiredDevice) {
            InCallManager.chooseAudioRoute(wiredDevice.name);
          }
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
   * Select the best available audio channel with priority for external devices
   */
  private selectBestChannel(): AudioChannel {
    // Priority order: Bluetooth > Wired Headset > Speaker > Earpiece
    const priorityOrder = [
      AudioChannel.BLUETOOTH,
      AudioChannel.WIRED_HEADSET,
      AudioChannel.SPEAKER,
      AudioChannel.EARPIECE,
    ];

    for (const channel of priorityOrder) {
      if (this.availableChannels.includes(channel)) {
        return channel;
      }
    }

    return AudioChannel.SPEAKER; // Fallback
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
    this.audioStream = stream;
    this.applySpeakerMute(); // apply any mute user set before stream arrived
    await this.routeWebRTCAudio();
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
      // Apply current channel configuration for WebRTC audio
      // Re-initialize audio session to apply routing changes
      if (Platform.OS === "ios") {
        await this.initializeIOS();
      } else {
        await this.initializeAndroid();
      }

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
    const targetChannel = speakerOn
      ? AudioChannel.SPEAKER
      : AudioChannel.EARPIECE;
    await this.setAudioChannel(targetChannel);
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
   * Clean up WebRTC audio resources
   */
  async cleanup(): Promise<void> {
    try {
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
      const { DeviceEventEmitter } = require("react-native");
      DeviceEventEmitter.removeAllListeners("WiredHeadset");
      DeviceEventEmitter.removeAllListeners("Proximity");
      DeviceEventEmitter.removeAllListeners("NoisyAudio");
      DeviceEventEmitter.removeAllListeners("MediaButton");

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