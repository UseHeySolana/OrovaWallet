import { MediaStream } from 'react-native-webrtc';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import { Platform } from "react-native";

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

class AudioManager {
  private audioStream: MediaStream | null = null;
  private currentChannel: AudioChannel = AudioChannel.SPEAKER;
  private availableChannels: AudioChannel[] = [];
  private isInitialized: boolean = false;

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

      // Platform-specific initialization
      if (Platform.OS === "ios") {
        await this.initializeIOS();
      } else {
        await this.initializeAndroid();
      }

      // Detect available audio channels
      await this.detectAvailableChannels();

      // Set initial audio mode
      await this.setAudioChannel(AudioChannel.SPEAKER);

      this.isInitialized = true;
      console.log("AudioManager initialized successfully for", Platform.OS);
    } catch (error) {
      console.error("Failed to initialize AudioManager:", error);
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
   * Detect available audio output channels based on platform
   */
  private async detectAvailableChannels(): Promise<void> {
    // Base channels available on all devices
    this.availableChannels = [AudioChannel.SPEAKER, AudioChannel.EARPIECE];

    // Add additional channels (in production, these would be detected dynamically)
    this.availableChannels.push(
      AudioChannel.BLUETOOTH,
      AudioChannel.WIRED_HEADSET
    );

    console.log("Available audio channels:", this.availableChannels);
  }

  /**
   * Get platform-specific audio mode configuration for WebRTC
   */
  private getAudioModeConfig(channel: AudioChannel): AudioModeConfig {
    if (Platform.OS === "ios") {
      return this.getIOSAudioConfig(channel);
    } else {
      return this.getAndroidAudioConfig(channel);
    }
  }

  /**
   * iOS-specific audio configuration for WebRTC streams
   */
  private getIOSAudioConfig(channel: AudioChannel): AudioModeConfig {
    const baseConfig: AudioModeConfig = {
      allowsRecordingIOS: true, // Required for WebRTC audio routing
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      playsInSilentModeIOS: true, // Essential for VoIP/calling apps
      staysActiveInBackground: true,
    };

    switch (channel) {
      case AudioChannel.SPEAKER:
        return {
          ...baseConfig,
          // iOS will route to speaker by default when not using earpiece
        };

      case AudioChannel.EARPIECE:
        return {
          ...baseConfig,
          // For earpiece, we need to use a different approach on iOS
          // This might require native iOS code to force earpiece routing
        };

      case AudioChannel.BLUETOOTH:
      case AudioChannel.WIRED_HEADSET:
        return {
          ...baseConfig,
          // iOS automatically routes to these when connected
        };

      default:
        return baseConfig;
    }
  }

  /**
   * Android-specific audio configuration for WebRTC streams
   */
  private getAndroidAudioConfig(channel: AudioChannel): AudioModeConfig {
    const baseConfig: AudioModeConfig = {
      shouldDuckAndroid: true,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      staysActiveInBackground: true,
      playThroughEarpieceAndroid: false,
    };

    switch (channel) {
      case AudioChannel.SPEAKER:
        return {
          ...baseConfig,
          playThroughEarpieceAndroid: false,
        };

      case AudioChannel.EARPIECE:
        return {
          ...baseConfig,
          playThroughEarpieceAndroid: true,
        };

      case AudioChannel.BLUETOOTH:
      case AudioChannel.WIRED_HEADSET:
        return {
          ...baseConfig,
          playThroughEarpieceAndroid: false,
        };

      default:
        return baseConfig;
    }
  }

  /**
   * Set the audio output channel for WebRTC stream
   */
  async setAudioChannel(channel: AudioChannel): Promise<void> {
    if (!this.isInitialized) {
      console.warn("AudioManager not initialized yet");
      return;
    }

    try {
      // Validate channel availability
      if (
        channel !== AudioChannel.AUTO &&
        !this.availableChannels.includes(channel)
      ) {
        console.warn(
          `Channel ${channel} not available, falling back to speaker`
        );
        channel = AudioChannel.SPEAKER;
      }

      // Handle auto channel selection
      if (channel === AudioChannel.AUTO) {
        channel = this.selectBestChannel();
      }

      // Apply platform-specific configuration
      const config = this.getAudioModeConfig(channel);
      await Audio.setAudioModeAsync(config);

      // iOS-specific channel routing
      if (Platform.OS === "ios") {
        await this.routeIOSAudio(channel);
      }

      this.currentChannel = channel;
      console.log(`WebRTC audio channel set to: ${channel} on ${Platform.OS}`);

      // Re-route existing WebRTC audio if available
      if (this.audioStream) {
        await this.routeWebRTCAudio();
      }
    } catch (error) {
      console.error(`Failed to set audio channel to ${channel}:`, error);
    }
  }

  /**
   * iOS-specific audio routing for WebRTC
   */
  private async routeIOSAudio(channel: AudioChannel): Promise<void> {
    try {
      switch (channel) {
        case AudioChannel.SPEAKER:
          // iOS: Force speaker output for WebRTC
          // In a real implementation, you'd use native iOS code:
          // AVAudioSession.sharedInstance().overrideOutputAudioPort(.speaker)
          break;

        case AudioChannel.EARPIECE:
          // iOS: Force earpiece/receiver output for WebRTC
          // In a real implementation, you'd use native iOS code:
          // AVAudioSession.sharedInstance().overrideOutputAudioPort(.none)
          break;

        case AudioChannel.BLUETOOTH:
        case AudioChannel.WIRED_HEADSET:
          // iOS: Allow automatic routing to these devices when connected
          break;
      }

      console.log(`iOS WebRTC audio routed to ${channel}`);
    } catch (error) {
      console.error("Error routing iOS WebRTC audio:", error);
    }
  }

  /**
   * Select the best available audio channel
   */
  private selectBestChannel(): AudioChannel {
    // Priority order for WebRTC audio
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
   * Handle incoming remote audio stream from WebRTC
   */
  async handleRemoteStream(stream: MediaStream): Promise<void> {
    console.log("Received remote WebRTC audio stream");
    this.audioStream = stream;
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
      const config = this.getAudioModeConfig(this.currentChannel);
      await Audio.setAudioModeAsync(config);

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
   * Mute/unmute WebRTC audio stream
   */
  muteAudio(muted: boolean): void {
    if (!this.audioStream) {
      console.warn("No WebRTC audio stream to mute");
      return;
    }

    const audioTracks = this.audioStream.getAudioTracks();
    audioTracks.forEach((track) => {
      track.enabled = !muted;
    });

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
