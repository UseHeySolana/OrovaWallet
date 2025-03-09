import Meyda from "meyda";

export class VoiceVerification {

    constructor() {}

    extractFeatures = async (audioBuffer: any) => {
        const context = new AudioContext();
        const source = context.createBufferSource();
        const audioData = await context.decodeAudioData(audioBuffer);

        source.buffer = audioData;
        const analyzer = Meyda.createMeydaAnalyzer({
            audioContext: context,
            source: source,
            bufferSize: 1024,
            featureExtractors: ["mfcc"],
        });

        source.start();
        return analyzer.get()?.mfcc || [];
    }

}