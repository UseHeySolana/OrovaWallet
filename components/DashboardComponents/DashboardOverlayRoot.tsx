import { StyleSheet, View } from "react-native";

import { useWalletScroll } from "@/context/WalletScrollContext";

export default function DashboardOverlayRoot({
  children,
  overlay,
}: {
  children: React.ReactNode;
  overlay: React.ReactNode;
}) {
  const { overlayRootRef } = useWalletScroll();

  return (
    <View
      ref={overlayRootRef}
      collapsable={false}
      className="flex-1 bg-grey dark:bg-dark"
    >
      <View
        pointerEvents="box-none"
        style={[StyleSheet.absoluteFillObject, { zIndex: 200 }]}
      >
        {overlay}
      </View>
      {children}
    </View>
  );
}
