import { Audio } from "expo-av";
import {VoiceVerification} from './voiceAuth'
import LiveAudioStream from 'react-native-live-audio-stream';
import { Buffer } from 'buffer';
import RNFS from 'react-native-fs';
import * as FileSystem from 'expo-file-system';
import AudioRecord from 'react-native-audio-record';


export class AudioManager extends VoiceVerification {
    private isListening: boolean = false;
    public isAIPlaying: boolean = false;
    private recording: any;
    private audioFilePath: string | null = null;
    public audioChunks: any[] = [];
    private silenceTimeout: any;

    public callbacks: {
        onSpeechStart: () => void;
        onSpeechEnd: () => void;
        onProcessingStart: () => void;
        onProcessingEnd: () => void;
        onAiSpeakingStart: () => void;
        onAiSpeakingEnd: () => void;
    };

    constructor(callbacks: {
        onSpeechStart: () => void;
        onSpeechEnd: () => void;
        onProcessingStart: () => void;
        onProcessingEnd: () => void;
        onAiSpeakingStart: () => void;
        onAiSpeakingEnd: () => void;
    }) {
        super()
        this.callbacks = callbacks;
        this.init();
        this.requestPermissions();
    }


    requestPermissions = async () => {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== "granted") {
            alert("Microphone permission is required for voice authentication.");
        }

        await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
        });
    }


    async init() {

        const options = {
            sampleRate: 32000,  // default is 44100 but 32000 is adequate for accurate voice recognition
            channels: 1,        // 1 or 2, default 1
            bitsPerSample: 16,  // 8 or 16, default 16
            audioSource: 6,     // android only (see below)
            bufferSize: 4096, // default is 2048
            wavFile: "/arie", //
          };
          
        AudioRecord.init(options);
        
    }
    analyseAudio = async () => {
        AudioRecord.on('data', (data: any) => {
            // console.log("analysing");
            let ana = 0
            const buffer = Buffer.from(data, 'base64');
            const amplitude = this.getAmplitude(buffer);
            console.log("Amplitude:", amplitude); // Debugging
            if (amplitude > 1000) {
                // Speech detected (adjust threshold as needed)
                console.log("speech detected");

                clearTimeout(this.silenceTimeout);
            } else {
                // Silence detected, start timeout
                if (!this.silenceTimeout) {
                    this.silenceTimeout = setTimeout(() => {

                        // this.stopRecording();
                        console.log("silence detected");
                    }, 1500); // 1.5 seconds of silence
                }
            }
        });

    }


    getAmplitude(buffer: Buffer): number {
        let sum = 0;
        const length = buffer.length;

        for (let i = 0; i < length; i += 2) {
            const int16 = buffer.readInt16LE(i); // Convert to signed 16-bit PCM value
            sum += int16 * int16;
        }

        return Math.sqrt(sum / (length / 2)); // RMS calculation
    }


    startRecording = async () => {
        AudioRecord.start();
        this.analyseAudio();
    }

    stopRecording = async () => {
        const audioFile = await AudioRecord.stop();

        try {
            const { sound } = await Audio.Sound.createAsync({ uri: audioFile });
            await sound.playAsync();
        } catch (error) {
            console.error("Error saving or playing audio:", error);
        }
    }
}
