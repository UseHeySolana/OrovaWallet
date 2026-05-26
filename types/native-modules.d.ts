declare module "react-native-audio-record" {
  type AudioRecordOptions = {
    sampleRate?: number;
    channels?: number;
    bitsPerSample?: number;
    wavFile?: string;
  };

  const AudioRecord: {
    init(options: AudioRecordOptions): void;
    on(event: "data", callback: (data: string) => void): void;
    start(): void;
    stop(): Promise<string>;
  };

  export default AudioRecord;
}
