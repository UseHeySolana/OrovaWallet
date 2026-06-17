import { Pressable, View } from "react-native";
import CText from "@/components/TextComp";
import Feather from "@expo/vector-icons/Feather";
import type { VoiceBackend } from "@/libs/voiceinfra/types";
import {
  voiceBackendOptions,
  type VoiceBackendOption,
} from "@/libs/voiceinfra/voiceBackendCopy";

type VoiceEnginePickerProps = {
  selected: VoiceBackend;
  onSelect: (backend: VoiceBackend) => void;
  compact?: boolean;
};

function OptionCard({
  option,
  selected,
  onSelect,
  compact,
}: {
  option: VoiceBackendOption;
  selected: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  const bulletList = compact ? option.pros.slice(0, 2) : [...option.pros, ...option.cons];

  return (
    <Pressable
      onPress={onSelect}
      className={`rounded-2xl border p-4 ${
        selected
          ? "border-purple bg-purple/5 dark:bg-purple/15"
          : "border-grey/60 bg-white dark:border-line dark:bg-accent"
      }`}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-y-1">
          <CText style={{ fontFamily: "bold" }} className="text-[1.05rem]">
            {option.title}
          </CText>
          <CText className="text-[0.78rem] text-purple">{option.badge}</CText>
        </View>
        <View
          className={`h-6 w-6 items-center justify-center rounded-full border ${
            selected ? "border-purple bg-purple" : "border-grey/50"
          }`}
        >
          {selected ? <Feather name="check" size={14} color="#fff" /> : null}
        </View>
      </View>

      <CText className="mt-3 text-[0.88rem] leading-5 text-black/70 dark:text-grey/80">
        {option.summary}
      </CText>

      <View className="mt-3 gap-y-2">
        {bulletList.map((line) => (
          <View key={line} className="flex-row gap-x-2">
            <CText className="text-[0.82rem] text-black/50 dark:text-grey/60">•</CText>
            <CText className="flex-1 text-[0.82rem] leading-5 text-black/65 dark:text-grey/75">
              {line}
            </CText>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

export default function VoiceEnginePicker({
  selected,
  onSelect,
  compact = false,
}: VoiceEnginePickerProps) {
  return (
    <View className="gap-y-3">
      {voiceBackendOptions.map((option) => (
        <OptionCard
          key={option.id}
          option={option}
          selected={selected === option.id}
          onSelect={() => onSelect(option.id)}
          compact={compact}
        />
      ))}
    </View>
  );
}
