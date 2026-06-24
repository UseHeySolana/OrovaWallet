
import { useThemeContext } from "@/context/ThemeContext";
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Keyboard, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface DragableSheetProps {
    child: React.ReactNode;
    snapPoints?: string[] | null
    close?: () => void;
    panClose?: boolean;
}
const DragableSheet = (props: DragableSheetProps) => {
    const { child, snapPoints, close, panClose } = props;
    const [resetView, setResetView] = useState(true)
    const bottomSheetRef = useRef<BottomSheet>(null);

    const onChange = (e: any) => {
        if (e < 1) {
            bottomSheetRef.current?.expand;
        }
    }
    const { isDarkMode } = useThemeContext()
    return (
        <BottomSheet
            keyboardBehavior="interactive"
            keyboardBlurBehavior="restore"
            onClose={() => close && close()}
            ref={bottomSheetRef}
            backgroundStyle={{
                backgroundColor: isDarkMode ? '#131313' : 'white',
                paddingBottom: 20,
            }}
            onChange={(e) => onChange(e)}
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
                        backgroundColor: 'black',
                    }}
                />
            )}
            enablePanDownToClose={panClose ?? false}
        >
            <BottomSheetView className="h-full px-4 rounded-t-3xl">
                <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss} accessible={false}>
                    {child}
                </Pressable>
            </BottomSheetView>
        </BottomSheet>

    )
}

export default DragableSheet
