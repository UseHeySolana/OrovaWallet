import { useThemeContext } from "@/context/ThemeContext";
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import React, { useEffect, useRef } from "react";

interface DragableSheetModalProps {
  child: React.ReactNode;
  snapPoints?: string[] | null;
  close?: () => void;
  panClose?: boolean;
}

/**
 * Full-screen bottom sheet modal. Renders via BottomSheetModalProvider
 * so it is not clipped by parent views (e.g. chat message). Use for
 * confirm payment and other overlays that must appear above the whole screen.
 */
const DragableSheetModal = (props: DragableSheetModalProps) => {
  const { child, snapPoints, close, panClose } = props;
  const bottomSheetRef = useRef<React.ComponentRef<typeof BottomSheetModal>>(null);
  const { isDarkMode } = useThemeContext();

  useEffect(() => {
    bottomSheetRef.current?.present();
  }, []);

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      onDismiss={() => close?.()}
      snapPoints={snapPoints ?? ["45%", "55%"]}
      enablePanDownToClose={panClose ?? true}
      backgroundStyle={{
        backgroundColor: isDarkMode ? "#131313" : "white",
        paddingBottom: 20,
      }}
      backdropComponent={(backdropProps) => (
        <BottomSheetBackdrop
          {...backdropProps}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          pressBehavior="close"
          style={{
            height: "100%",
            backgroundColor: "black",
          }}
        />
      )}
    >
      <BottomSheetView className="h-full px-4 rounded-t-3xl">
        {child}
      </BottomSheetView>
    </BottomSheetModal>
  );
};

export default DragableSheetModal;
