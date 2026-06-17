/**
 * Run QVAC voice models on your laptop and share them with your phone over Hyperswarm.
 *
 * Usage (from the HeySolanaWallet repo root):
 *   npm run qvac:laptop-host
 *
 * Keep this terminal open while using Private AI in "My laptop" mode on your phone.
 * Paste the printed Provider Public Key into AI Settings on the app.
 */
import {
  loadModel,
  startQVACProvider,
  LLAMA_3_2_1B_INST_Q4_0,
  TTS_EN_SUPERTONIC_Q8_0,
  VAD_SILERO_5_1_2,
  WHISPER_TINY,
} from "@qvac/sdk";

const VAD_PARAMS = {
  threshold: 0.6,
  min_speech_duration_ms: 300,
  min_silence_duration_ms: 700,
  max_speech_duration_s: 15.0,
  speech_pad_ms: 200,
};

function logProgress(label, progress) {
  const pct = progress?.percentage?.toFixed?.(1) ?? "?";
  console.log(`  ${label}: ${pct}%`);
}

async function main() {
  console.log("Starting QVAC laptop host for HeySolana voice assistant...\n");

  const provider = await startQVACProvider();
  console.log(`Provider public key:\n  ${provider.publicKey}\n`);
  console.log("Copy the key above into HeySolana → AI Settings → Laptop provider key.\n");
  console.log("Loading voice models (first run downloads ~1 GB)...\n");

  await loadModel({
    modelSrc: WHISPER_TINY,
    modelType: "whispercpp-transcription",
    modelConfig: {
      vadModelSrc: VAD_SILERO_5_1_2,
      audio_format: "f32le",
      strategy: "greedy",
      n_threads: 4,
      language: "en",
      no_timestamps: true,
      suppress_blank: true,
      suppress_nst: true,
      temperature: 0.0,
      vad_params: VAD_PARAMS,
    },
    onProgress: (p) => logProgress("Whisper + VAD", p),
  });

  await loadModel({
    modelSrc: LLAMA_3_2_1B_INST_Q4_0,
    modelType: "llamacpp-completion",
    modelConfig: { ctx_size: 4096 },
    onProgress: (p) => logProgress("Llama", p),
  });

  await loadModel({
    modelSrc: TTS_EN_SUPERTONIC_Q8_0,
    modelType: "tts-ggml",
    modelConfig: {
      ttsEngine: "supertonic",
      language: "en",
      voice: "F1",
      ttsSpeed: 1.05,
      ttsNumInferenceSteps: 5,
    },
    onProgress: (p) => logProgress("TTS", p),
  });

  console.log("\nReady — phone can connect in Private AI → My laptop mode.");
  console.log("Press Ctrl+C to stop.\n");

  process.stdin.resume();
  process.on("SIGINT", () => {
    console.log("\nLaptop host stopped.");
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Laptop host failed:", error);
  process.exit(1);
});
