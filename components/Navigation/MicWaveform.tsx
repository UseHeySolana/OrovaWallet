import React from "react";
import { View } from "react-native";
import type SessionManager from "@/libs/voiceinfra/SessionManager";

const BAR_COUNT = 14;
const POLL_MS = 70;
const MIN_BAR = 0.12;

type MicWaveformProps = {
  active: boolean;
  sessionManager: SessionManager | null;
  /** Called with the latest 0–1 level (boosted for UI). */
  onLevel?: (level: number) => void;
};

function boostLevel(raw: number): number {
  // Speech RMS from WebRTC is often quiet; curve + gain for readable bars.
  return Math.min(1, Math.pow(Math.max(0, raw), 0.45) * 2.4);
}

export function MicWaveform({
  active,
  sessionManager,
  onLevel,
}: MicWaveformProps) {
  const [bars, setBars] = React.useState(() =>
    Array.from({ length: BAR_COUNT }, () => MIN_BAR)
  );
  const onLevelRef = React.useRef(onLevel);
  onLevelRef.current = onLevel;

  React.useEffect(() => {
    if (!active || !sessionManager) {
      setBars(Array.from({ length: BAR_COUNT }, () => MIN_BAR));
      onLevelRef.current?.(0);
      return undefined;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      const raw = await sessionManager.getLocalMicLevel();
      if (cancelled) return;

      const level = boostLevel(raw);
      onLevelRef.current?.(level);
      setBars((prev) => {
        const next = prev.slice(1);
        next.push(Math.max(MIN_BAR, level));
        return next;
      });

      timer = setTimeout(tick, POLL_MS);
    };

    void tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      onLevelRef.current?.(0);
    };
  }, [active, sessionManager]);

  return (
    <View
      className="h-9 px-3 flex-row items-center justify-center gap-0.5 rounded-full border border-white/70 dark:border-white/10 shadow"
      style={{ backgroundColor: "rgba(151, 27, 178, 0.92)", minWidth: 88 }}
      accessibilityLabel="Microphone level"
    >
      {bars.map((height, index) => (
        <View
          key={index}
          style={{
            width: 3,
            height: 4 + height * 24,
            borderRadius: 2,
            backgroundColor: "#FFFFFF",
            opacity: 0.55 + height * 0.45,
          }}
        />
      ))}
    </View>
  );
}
