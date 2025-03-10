import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { StatusBar } from "react-native";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface DragableSheetProps {
    child: React.ReactNode;
    snapPoints?: string[] | null
    close?: ()=>void;
}
const DragableSheet = (props: DragableSheetProps) => {
    const { child, snapPoints, close } = props;
    const [resetView, setResetView ]= useState(true)
    const bottomSheetRef = useRef<BottomSheet>(null);
    // useEffect(()=>{
    //     bottomSheetRef.current?.snapToIndex(0);
    // },[bottomSheetRef])
  
    const onChange = (e:any)=>{
        if(e < 1){
            bottomSheetRef.current?.expand;
        }
    }
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
        <>
            {/* <Pressable onPress={()=>{close? close(): ""}} className="bg-black/50 h-screen w-screen top-0 absolute backdrop-blur-lg "> */}
            {/* <SafeAreaView style={{ backgroundColor:'black' }}> */}
            {/* <StatusBar  */}
            {/* // backgroundColor={resetView ? "#00000085" : "#f3f3f3"}  /> */}
            {/* </SafeAreaView> */}
            {/* <BlurView
            className="h-screen w-screen "
                blurType="dark" // Options: "light", "dark", "extraLight"
                blurAmount={10} // Adjust blur intensity
                reducedTransparencyFallbackColor="white"

            > */}


        <BottomSheet
        keyboardBehavior="interactive"
                keyboardBlurBehavior="restore"

        onClose={()=>{}}
        style={{}}
            ref={bottomSheetRef}
            onChange={(e) => onChange(e)}
            snapPoints={snapPoints ? snapPoints : ["60%"]}
            backdropComponent={(props)=>
                <BottomSheetBackdrop
                {...props}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
                pressBehavior="close"
                // You can customize these styles
                style={{
                    height: "100%",
                  backgroundColor: '#0000000',
                }}
              />
            }
            enablePanDownToClose={false}
                containerStyle={{
                    zIndex: 44,
                    flex: 1,
                }}
        >
            <BottomSheetView className="py-5  w-screen px-4" >
                {child}
            </BottomSheetView>
        </BottomSheet>
            {/* </BlurView> */}

            {/* </Pressable> */}
        </>

    )
}

export default DragableSheet
