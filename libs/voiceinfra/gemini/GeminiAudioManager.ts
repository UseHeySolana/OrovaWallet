import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';

class GeminiAudioManager {
    // public static instance: GeminiAudioManager;
    private audioQueue: string[] = [];
    private isPlaying: boolean = false;
    private sound: Audio.Sound | null = null;

    constructor() { }

    // static getInstance(): GeminiAudioManager {
    //     if (!GeminiAudioManager.instance) {
    //         GeminiAudioManager.instance = new GeminiAudioManager();
    //     }
    //     return GeminiAudioManager.instance;
    // }

    enqueueAudioChunk(base64Audio: string) {
        this.audioQueue.push(base64Audio);
        if (!this.isPlaying) {
            this.processAudioQueue();
        }
    }

    private async processAudioQueue() {
        if (this.audioQueue.length === 0) {
            this.isPlaying = false;
            return;
        }

        this.isPlaying = true;
        const audioData = this.audioQueue.shift();

        if (!audioData) {
            this.processAudioQueue();
            return;
        }

        const wavHeader = this.createWAVHeader(audioData.length);
        const wavFile = Buffer.concat([
            Buffer.from(wavHeader),
            Buffer.from(audioData, 'base64')
        ]);

        const fileUri = `${FileSystem.cacheDirectory}temp_audio_${Date.now()}.wav`;
        await FileSystem.writeAsStringAsync(
            fileUri,
            Buffer.from(wavFile).toString('base64'),
            { encoding: FileSystem.EncodingType.Base64 }
        );

        const { sound } = await Audio.Sound.createAsync(
            { uri: fileUri },
            { shouldPlay: false, volume: 1.0 }
        );

        this.sound = sound;
        console.log('Playing next audio chunk');

        sound.setOnPlaybackStatusUpdate(async (status) => {
            if (!status.isLoaded) {
                console.log('Sound playback error:', status);
                await sound.unloadAsync();
                this.processAudioQueue();
                return;
            }

            if (status.didJustFinish) {
                console.log('Finished playing chunk');
                await sound.unloadAsync();
                this.processAudioQueue();
            }
        });

        await sound.playAsync();
    }

    private createWAVHeader(dataLength: number): Uint8Array {
        const header = new Uint8Array(44);
        const view = new DataView(header.buffer);

        view.setUint32(0, 0x52494646, false); // "RIFF"
        view.setUint32(4, 36 + dataLength, true);
        view.setUint32(8, 0x57415645, false); // "WAVE"
        view.setUint32(12, 0x666d7420, false); // "fmt "
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, 16000, true);
        view.setUint32(28, 32000, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        view.setUint32(36, 0x64617461, false); // "data"
        view.setUint32(40, dataLength, true);

        return header;
    }
}

export default GeminiAudioManager;
