
import { useThemeContext } from "@/context/ThemeContext";
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { StatusBar } from "react-native";
import { Pressable, View } from "react-native";
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
    // const renderBackdrop = useMemo(
    //     () => (props:any) => (
    //       <BottomSheetBackdrop
    //         {...props}
    //         disappearsOnIndex={-1}
    //         appearsOnIndex={0}
    //         pressBehavior="close"
    //         // You can customize these styles
    //         style={{
    //             height: "100%",
    //             border: "1px solid black",
    //           backgroundColor: '#0000000',
    //         }}
    //       />
    //     ),
    //     []
    // );
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
            backdropComponent={(props) =>
                <BottomSheetBackdrop
                    {...props}
                    disappearsOnIndex={-1}
                    appearsOnIndex={0}
                    pressBehavior="collapse"
                    style={{
                        height: "100%",
                        backgroundColor: 'black',
                    }}
                />
            }
            enablePanDownToClose={panClose ?? false}
        >
            <BottomSheetView className="h-full px-4 rounded-t-3xl" >
                {child}
            </BottomSheetView>
        </BottomSheet>

    )
}

export default DragableSheet
