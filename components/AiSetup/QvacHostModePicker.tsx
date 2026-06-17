import { Pressable, TextInput, View } from "react-native";
import CText from "@/components/TextComp";
import Feather from "@expo/vector-icons/Feather";
import type { QvacHostMode } from "@/libs/voiceinfra/types";
import { qvacHostModeOptions } from "@/libs/voiceinfra/voiceBackendCopy";

type QvacHostModePickerProps = {
  hostMode: QvacHostMode;
  providerPublicKey: string;
  onHostModeChange: (mode: QvacHostMode) => void;
  onProviderKeyChange: (key: string) => void;
};

function HostOption({
  option,
  selected,
  onSelect,
}: {
  option: (typeof qvacHostModeOptions)[number];
  selected: boolean;
  onSelect: () => void;
}) {
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
          <CText style={{ fontFamily: "bold" }} className="text-[1rem]">
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
      <CText className="mt-2 text-[0.86rem] leading-5 text-black/70 dark:text-grey/80">
        {option.summary}
      </CText>
    </Pressable>
  );
}

export default function QvacHostModePicker({
  hostMode,
  providerPublicKey,
  onHostModeChange,
  onProviderKeyChange,
}: QvacHostModePickerProps) {
  return (
    <View className="gap-y-3">
      {qvacHostModeOptions.map((option) => (
        <HostOption
          key={option.id}
          option={option}
          selected={hostMode === option.id}
          onSelect={() => onHostModeChange(option.id)}
        />
      ))}

      {hostMode === "laptop" ? (
        <View className="gap-y-2 rounded-2xl border border-purple/20 bg-purple/5 p-4 dark:bg-purple/10">
          <CText style={{ fontFamily: "bold" }} className="text-[0.92rem]">
            Laptop provider key
          </CText>
          <CText className="text-[0.82rem] leading-5 text-black/65 dark:text-grey/75">
            On your computer, open the HeySolana wallet repo and run{" "}
            <CText style={{ fontFamily: "bold" }}>npm run qvac:laptop-host</CText>
            . Copy the provider public key it prints and paste it here. Keep that
            terminal open while you use voice.
          </CText>
          <TextInput
            value={providerPublicKey}
            onChangeText={onProviderKeyChange}
            placeholder="Paste provider public key"
            placeholderTextColor="#999"
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            style={{ fontFamily: "reg" }}
            className="min-h-[72px] rounded-xl border border-grey/40 bg-white px-3 py-2 text-[0.85rem] text-black dark:border-line dark:bg-dark dark:text-white"
          />
        </View>
      ) : null}
    </View>
  );
}
