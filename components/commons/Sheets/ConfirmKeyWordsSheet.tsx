import { KeyboardAvoidingView, Pressable, TextInput, View } from "react-native";
import DragableSheet from "@/components/commons/CustomItems/DragableSheet";
import CText from "@/components/TextComp";
import { useThemeContext } from "@/context/ThemeContext";

import { router } from "expo-router";
import AntDesign from "@expo/vector-icons/AntDesign";
import { Image } from "expo-image";
import IconLibrary from "@/utils/icons";
import Buttons from "@/components/ButtonComp";

interface ConfirmSheet {
    open: boolean;
    verifiedWords: { position: number, word: string }[];
    userWords: { position: number, word: string }[];
    setUserWords: (words: any) => void;
    currentState: string;
    validatePhrase: () => void;
    positionVal: string[]
    copyKeyPhrase: () => void;


}
const ConfirmPhraseSheet = ({
    open,
    verifiedWords,
    userWords,
    setUserWords,
    currentState,
    validatePhrase,
    positionVal,
    copyKeyPhrase
}: ConfirmSheet) => {
    const { isDarkMode } = useThemeContext();
    if (!open) return null;

    return (
        <DragableSheet
            // close={() => setVerifyPhrase(false)}
            snapPoints={["70%", "100%"]}
            child={
                <View className=" py-1 w-full px-4 gap-y-5 flex flex-col justify-between ">
                    <View className="w-8/12 m-auto">
                        <CText style={{ fontFamily: "bold" }} className="text-[20px] text-center">Confirm secret phrase</CText>
                        <CText className="text-[16px] text-center">Please enter the correct answer below from your secret phrase</CText>
                    </View>

                    <View className="bg-grey dark:bg-accent rounded-3xl gap-y-3 p-2">

                        {verifiedWords.length > 0 && verifiedWords.map((word, index) => (

                            <View key={index} className="bg-white dark:bg-accent2 p-3 rounded-2xl">

                                <View className="py-4">
                                    <CText className="text-[16px]" style={{ fontFamily: "bold" }} >Word #{word.position}</CText>
                                </View>
                                <View className="border-b border-gray-200 dark:border-dark">
                                </View>

                                <KeyboardAvoidingView
                                    behavior="height"
                                >
                                    <TextInput
                                        style={{ fontFamily: "bold" }}
                                        className="py-5"
                                        placeholderTextColor={isDarkMode ? "white" : "black"}
                                        onChangeText={(text) => {
                                            const newUserWords = [...userWords];
                                            newUserWords[index].word = text;
                                            newUserWords[index].position = word.position;
                                            setUserWords(newUserWords);
                                        }}
                                        placeholder={`enter ${positionVal[word.position - 1]} word...`}
                                    />
                                </KeyboardAvoidingView>



                            </View>
                        ))}



                    </View>

                    <Buttons buttonType="pressable" onPress={() => currentState === 'verify-phrase' ? validatePhrase() : copyKeyPhrase()} className="" text="Confirm" type="primary" />
                </View>
            }
        />
    )
}

export default ConfirmPhraseSheet;