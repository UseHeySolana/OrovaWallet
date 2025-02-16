
import AudioRecord from 'react-native-audio-record';
import { Audio } from "expo-av";
import {VoiceVerification} from './voiceAuth'
import LiveAudioStream from 'react-native-live-audio-stream';

export class AudioManager extends VoiceVerification {
    private isListening: boolean = false;
    public isAIPlaying: boolean = false;
    private recording: any;
    private audioFilePath: string | null = null;

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
            wavFile:"wav", //
          };
          
        LiveAudioStream.init(options);
        
        //  LiveAudioStream.start();

        //   LiveAudioStream.stop();
// this.callbacks.onSpeechStart();
// this.callbacks.onSpeechEnd();
        // Voice.onSpeechResults = async (e) => {
        //     if (e.value) {
        //         this.stopListening();
        //         this.callbacks.onProcessingStart();
        //         const transcribeText = e.value[0];
        //         console.log(transcribeText);
        //         // await this.convertAudioAndRespond(transcribeText);
        //     }
        // };

    }

    async startListeningToUser() {
        if (this.isListening || this.isAIPlaying) return;
        this.isListening = true;
        // Voice.start('en-US');
    }

    async convertAudioAndRespond(text: string) {
        // const feedback = await processAudioLang(this, text);
        // await this.playAudio(feedback);
    }

    // async playAudio(text: string) {
    //     this.callbacks.onAiSpeakingStart();
    //     this.isAIPlaying = true;

    //     // Convert text to speech
    //     const audioFilePath = await playText(this, text, true);
    //     if (!audioFilePath) return;

    //     this.audioFilePath = audioFilePath;
    //     const sound = new Sound(audioFilePath, Sound.MAIN_BUNDLE, (error) => {
    //         if (error) {
    //             console.log('Failed to load sound', error);
    //             return;
    //         }
    //         sound.play(() => {
    //             this.isAIPlaying = false;
    //             this.callbacks.onAiSpeakingEnd();
    //         });
    //     });
    // }

    stopListening() {
        if (!this.isListening) return;
        // Voice.stop();
        this.isListening = false;
        this.callbacks.onSpeechEnd();
    }

    cleanup() {
        this.stopListening();
        // Voice.destroy();
    }

    startRecording = async () => {
        LiveAudioStream.start();
    }

    stopRecording = async () => {
       let uri = await LiveAudioStream.stop();
       console.log(uri);
    }
}
