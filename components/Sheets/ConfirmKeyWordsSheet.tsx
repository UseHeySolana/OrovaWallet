import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CText from "../TextComp";
import IconLibrary from "@/utils/icons";
import Buttons from "../ButtonComp";

export interface PhraseVerificationChallenge {
    position: number;
    correctWord: string;
    options: string[];
}

interface ConfirmSheet {
    open: boolean;
    challenges: PhraseVerificationChallenge[];
    userWords: { position: number; word: string }[];
    setUserWords: (words: { position: number; word: string }[]) => void;
    validatePhrase: () => void;
    onBack: () => void;
}

function getOrdinal(n: number): string {
    const suffixes = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return `${n}${suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]}`;
}

const ConfirmPhraseSheet = ({
    open,
    challenges,
    userWords,
    setUserWords,
    validatePhrase,
    onBack,
}: ConfirmSheet) => {
    if (!open) return null;

    const allSelected = challenges.every((challenge) =>
        userWords.some(
            (entry) =>
                entry.position === challenge.position &&
                entry.word.trim().length > 0
        )
    );

    const handleSelectWord = (position: number, word: string) => {
        const next = [...userWords];
        const index = challenges.findIndex((c) => c.position === position);
        if (index === -1) return;
        next[index] = { position, word };
        setUserWords(next);
    };

    const getSelectedWord = (position: number) =>
        userWords.find((entry) => entry.position === position)?.word ?? "";

    return (
        <View className="absolute inset-0 z-50 bg-grey dark:bg-dark">
            <SafeAreaView className="flex-1">
                <View className="flex-1 px-4">
                    <View className="flex-row items-center gap-x-4 py-3">
                        <Pressable
                            onPress={onBack}
                            className="p-3 rounded-full bg-white dark:bg-accent"
                        >
                            <IconLibrary.back />
                        </Pressable>
                        <CText className="text-[14px] opacity-60">
                            Recovery Phrase verification
                        </CText>
                    </View>

                    <ScrollView
                        className="flex-1"
                        contentContainerStyle={{ paddingBottom: 24 }}
                        showsVerticalScrollIndicator={false}
                    >
                        <View className="gap-y-2 mt-4 mb-8">
                            <CText
                                style={{ fontFamily: "bold" }}
                                className="text-[28px]"
                            >
                                Confirm your Recovery Phrase
                            </CText>
                            <CText className="text-[16px] opacity-60">
                                Please select the right words in the correct order
                            </CText>
                        </View>

                        <View className="gap-y-8">
                            {challenges.map((challenge) => {
                                const selectedWord = getSelectedWord(
                                    challenge.position
                                );

                                return (
                                    <View key={challenge.position} className="gap-y-3">
                                        <CText className="text-[14px] opacity-60">
                                            {getOrdinal(challenge.position)} word
                                        </CText>

                                        <View className="flex-row gap-x-2">
                                            {challenge.options.map((option) => {
                                                const isSelected =
                                                    selectedWord === option;

                                                return (
                                                    <Pressable
                                                        key={`${challenge.position}-${option}`}
                                                        onPress={() =>
                                                            handleSelectWord(
                                                                challenge.position,
                                                                option
                                                            )
                                                        }
                                                        className={`flex-1 py-4 px-2 rounded-full items-center justify-center ${
                                                            isSelected
                                                                ? "bg-purple"
                                                                : "bg-white dark:bg-accent2"
                                                        }`}
                                                    >
                                                        <CText
                                                            style={{
                                                                fontFamily: "bold",
                                                            }}
                                                            className={`text-[15px] text-center ${
                                                                isSelected
                                                                    ? "text-white"
                                                                    : "text-dark dark:text-white"
                                                            }`}
                                                        >
                                                            {option}
                                                        </CText>
                                                    </Pressable>
                                                );
                                            })}
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </ScrollView>

                    <View className="py-4" style={{ opacity: allSelected ? 1 : 0.4 }}>
                        <Buttons
                            buttonType="pressable"
                            onPress={() => {
                                if (allSelected) validatePhrase();
                            }}
                            className=""
                            text="Confirm"
                            type="primary"
                        />
                    </View>
                </View>
            </SafeAreaView>
        </View>
    );
};

export default ConfirmPhraseSheet;
