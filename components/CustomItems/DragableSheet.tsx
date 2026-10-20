import { useThemeContext } from "@/context/ThemeContext";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import React, { useRef } from "react";
import { Keyboard, View } from "react-native";

interface DragableSheetProps {
  child: React.ReactNode;
  snapPoints?: string[] | null;
  close?: () => void;
  panClose?: boolean;
}

const DragableSheet = (props: DragableSheetProps) => {
  const { child, snapPoints, close, panClose } = props;
  const bottomSheetRef = useRef<BottomSheet>(null);
  const { isDarkMode } = useThemeContext();

  return (
    <BottomSheet
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      onClose={() => close && close()}
      ref={bottomSheetRef}
      backgroundStyle={{
        backgroundColor: isDarkMode ? "#131313" : "white",
        paddingBottom: 20,
      }}
      onChange={(index) => {
        if (index < 1) {
          bottomSheetRef.current?.expand();
        }
      }}
      snapPoints={snapPoints ? snapPoints : ["60%"]}
      backdropComponent={(backdropProps) => (
        <BottomSheetBackdrop
          {...backdropProps}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          pressBehavior="collapse"
          onPress={() => {
            Keyboard.dismiss();
            backdropProps.onPress?.();
          }}
          style={{
            height: "100%",
            backgroundColor: "black",
          }}
        />
      )}
      enablePanDownToClose={panClose ?? false}
    >
      {/*
        Do not wrap sheet content in Pressable + Keyboard.dismiss.
        On iPad that steals focus taps and the soft keyboard never appears.
      */}
      <BottomSheetView className="h-full px-4 rounded-t-3xl">
        <View style={{ flex: 1 }}>{child}</View>
      </BottomSheetView>
    </BottomSheet>
  );
};

export default DragableSheet;
