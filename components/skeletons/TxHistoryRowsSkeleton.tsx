import { Animated, View } from "react-native";
import { useSkeletonPulse } from "./useSkeletonPulse";

/** Matches wallet / token transaction list row height and rhythm. */
export function TxHistoryRowsSkeleton({ rows = 7 }: { rows?: number }) {
  const opacity = useSkeletonPulse();
  const bone = "rounded-md bg-grey dark:bg-accent2";

  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <View key={`tx-sk-${i}`}>
          <View className="px-4 py-4 w-full flex-row justify-between items-start">
            <View className="gap-2 flex-1 pr-3">
              <Animated.View
                style={{ opacity }}
                className={`h-3 w-[7rem] ${bone}`}
              />
              <View className="flex-row gap-2 items-center">
                <Animated.View
                  style={{ opacity }}
                  className="h-[30px] w-[30px] rounded-full bg-grey dark:bg-accent2"
                />
                <View className="flex-1 gap-2">
                  <Animated.View
                    style={{ opacity }}
                    className={`h-3 w-24 ${bone}`}
                  />
                  <Animated.View
                    style={{ opacity }}
                    className={`h-2.5 w-full max-w-[210px] ${bone}`}
                  />
                </View>
              </View>
            </View>
            <Animated.View
              style={{ opacity }}
              className={`h-3 w-14 ${bone} mt-0.5`}
            />
          </View>
          <View className="bg-grey dark:bg-dark w-full p-[0.6]" />
        </View>
      ))}
    </>
  );
}
