import React, { useMemo } from "react";
import { View } from "react-native";
import CText from "../TextComp";
import { PrivateTransferMeta } from "@/utils/store/conversation.store";
import { shortenPub } from "@/utils/functions/extrafunctions";

interface Props {
  transfer: PrivateTransferMeta;
}

const Chip: React.FC<{ label: string; tone?: "purple" | "neutral" | "green" }> = ({
  label,
  tone = "neutral",
}) => {
  const palette = {
    purple: "bg-[#7B5CFF]/20 dark:bg-[#7B5CFF]/30",
    neutral: "bg-grey dark:bg-accent",
    green: "bg-emerald-500/20 dark:bg-emerald-500/30",
  } as const;
  return (
    <View className={`px-2 py-1 rounded-full ${palette[tone]}`}>
      <CText className="text-[0.85rem] uppercase" style={{ fontFamily: "bold" }}>
        {label}
      </CText>
    </View>
  );
};

const formatDelay = (msStr: string) => {
  const ms = Number(msStr || "0");
  if (!Number.isFinite(ms) || ms <= 0) return "instant";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60_000)}m`;
};

const MagicBlockTransfer: React.FC<Props> = ({ transfer }) => {
  const dots = useMemo(() => {
    const total = Math.max(1, Math.min(15, transfer.split || 1));
    const settled = Math.max(0, Math.min(total, transfer.settlementProgress || 0));
    return { total, settled };
  }, [transfer.split, transfer.settlementProgress]);

  const isPrivate = transfer.visibility === "private";

  return (
    <View className="w-full p-3 rounded-xl bg-white dark:bg-accent2 gap-y-3">
      <View className="flex-row flex-wrap gap-2">
        <Chip
          label={isPrivate ? "Private" : "Public"}
          tone={isPrivate ? "purple" : "neutral"}
        />
        <Chip label={`${transfer.fromBalance} → ${transfer.toBalance}`} />
        {transfer.gasless && <Chip label="Gasless" tone="green" />}
        {isPrivate && transfer.split > 1 && (
          <Chip label={`Split × ${transfer.split}`} />
        )}
      </View>

      <View className="gap-y-1">
        <View className="flex-row items-center justify-between">
          <CText className="text-[1rem]">Amount</CText>
          <CText className="text-[1rem]" style={{ fontFamily: "bold" }}>
            {transfer.amount} {transfer.tokenSymbol}
          </CText>
        </View>
        <View className="flex-row items-center justify-between">
          <CText className="text-[1rem]">To</CText>
          <CText className="text-[1rem]">{shortenPub(transfer.recipient)}</CText>
        </View>
        {isPrivate && (
          <View className="flex-row items-center justify-between">
            <CText className="text-[1rem]">Delay</CText>
            <CText className="text-[1rem]">
              {formatDelay(transfer.minDelayMs)} – {formatDelay(transfer.maxDelayMs)}
            </CText>
          </View>
        )}
      </View>

      {isPrivate && dots.total > 1 && (
        <View>
          <CText className="text-[0.9rem] uppercase mb-1">
            Settlement {dots.settled}/{dots.total}
          </CText>
          <View className="flex-row gap-x-1">
            {Array.from({ length: dots.total }).map((_, i) => (
              <View
                key={i}
                className={`w-3 h-3 rounded-full ${
                  i < dots.settled
                    ? "bg-emerald-500"
                    : "bg-grey dark:bg-accent border border-[#7B5CFF]/40"
                }`}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

export default MagicBlockTransfer;
