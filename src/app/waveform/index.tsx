
import React, { useEffect, useState } from "react";
import { View, PermissionsAndroid, Pressable } from "react-native";
import { Audio } from "expo-av";
import Svg, { Path } from "react-native-svg";
import Buttons from "@/src/components/ButtonComp";

const AudioWaveformSVG = () => {
  const [waveform, setWaveform] = useState<string>("");

  useEffect(() => {
    const requestPermission = async () => {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    };
    requestPermission();
  }, []);

  const startRecording = async () => {
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) return;

    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets._HIGH_QUALITY);
    await recording.startAsync();

    const interval = setInterval(async () => {
      const status = await recording.getStatusAsync();
      if (status.metering) {
        // Convert metering into waveform data
        const wavePath = generateWaveform(status.metering);
        setWaveform(wavePath);
      }
    }, 200);

    return () => clearInterval(interval);
  };

  const generateWaveform = (metering: number) => {
    let path = "M 0 50 ";
    for (let i = 0; i < 10; i++) {
      let height = Math.max(5, Math.min(50, (metering + 160) * 2));
      path += `L ${i * 10} ${50 - height} `;
    }
    return path;
  };

  return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", }}>
          <View className="w-full">
              <Buttons
                  text="Start Recording"
                  onPress={startRecording}
              />
          </View>
      <Svg width={200} height={100}>
        <Path d={waveform} stroke="#4CAF50" strokeWidth={2} fill="none" />
      </Svg>
    </View>
  );
};

export default AudioWaveformSVG;
