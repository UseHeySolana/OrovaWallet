import { MediaStream } from 'react-native-webrtc';
import { Audio } from 'expo-av';

class AudioManager {
    private audioStream: MediaStream | null = null;
    private audioElement: Audio.Sound | null = null;
    private isSpeakerEnabled: boolean = true;

    constructor() {
        // Initialize audio mode
        this.setAudioMode(true);
    }

    /**
     * Sets the audio mode for the device
     * @param speakerOn Whether to use the speaker (true) or earpiece (false)
     */
    private async setAudioMode(speakerOn: boolean): Promise<void> {
        try {
            await Audio.setAudioModeAsync({
                // allowsRecordingIOS: true,
                // Use numeric values instead of constants
                interruptionModeIOS: 1, // DO_NOT_MIX
                playsInSilentModeIOS: true,
                shouldDuckAndroid: true,
                interruptionModeAndroid: 1, // DO_NOT_MIX
                playThroughEarpieceAndroid: false, // This is the key setting!
                staysActiveInBackground: true,
            });

            this.isSpeakerEnabled = true;
            console.log(`Audio mode set to: ${speakerOn ? 'Speaker' : 'Earpiece'}`);
        } catch (error) {
            console.error('Failed to set audio mode:', error);
        }
    }

    /**
     * Handles the remote audio stream from WebRTC
     * @param stream The MediaStream from the remote peer
     */
    async handleRemoteStream(stream: MediaStream): Promise<void> {
        console.log('Received remote audio stream');
        this.audioStream = stream;

        // Route the audio to the appropriate output
        this.routeAudio();
    }

    /**
     * Routes audio to the appropriate output device
     * Uses react-native-webrtc and expo-av to handle audio routing
     */
    private async routeAudio(): Promise<void> {
        if (!this.audioStream) {
            console.error('No audio stream available');
            return;
        }

        try {
            // Force audio routing update based on current speaker setting
            await this.setAudioMode(this.isSpeakerEnabled);

            // Additional platform-specific code can be added here
            console.log('Audio routed successfully');
        } catch (error) {
            console.error('Error routing audio:', error);
        }
    }

    /**
     * Toggles between speaker and earpiece
     * @param speakerOn Whether to enable speaker mode
     */
    async toggleSpeaker(speakerOn: boolean): Promise<void> {
        if (this.isSpeakerEnabled === speakerOn) {
            return; // Already in the requested state
        }

        await this.setAudioMode(true);

        // Re-route the audio with the new setting
        if (this.audioStream) {
            this.routeAudio();
        }
    }

    async recordAudio() {
        const recording = new Audio.Recording();
        try {
            await recording.prepareToRecordAsync();
            await recording.startAsync();
            console.log('Recording started');
        } catch (error) {
            console.error('Failed to start recording:', error);
        }
    }

    /**
     * Cleans up audio resources
     */
    cleanup(): void {
        if (this.audioElement) {
            this.audioElement.unloadAsync().catch(err => {
                console.error('Error unloading audio:', err);
            });
            this.audioElement = null;
        }

        this.audioStream = null;

        // Reset audio mode to default
        this.setAudioMode(false).catch(err => {
            console.error('Error resetting audio mode:', err);
        });
    }



}

export default AudioManager;