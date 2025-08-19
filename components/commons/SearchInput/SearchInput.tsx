import { useThemeContext } from "@/context/ThemeContext";
import IconLibrary from "@/utils/icons";
import { TextInput, View } from "react-native";

interface SearchInputProps {
    onSearch: (text: string) => void;
    value: string;
}

export default function SearchInput({ onSearch, value }: SearchInputProps) {
    const { isDarkMode } = useThemeContext()

    return (
        <View className="flex flex-row justify-between items-center gap-x-2  ">
            <View
                className=" flex flex-row items-center  gap-x-2 justify-start p-4 rounded-xl  text-start  w-full bg-white dark:bg-accent"
            >
                <IconLibrary.search />
                <TextInput
                    style={{ fontFamily: "bold", fontSize: 15 }}
                    value={value}
                    placeholder="Search"
                    className="w-full text-black dark:text-white"
                    placeholderTextColor={isDarkMode ? 'white' : 'black'}
                    numberOfLines={100}
                    onChangeText={onSearch}
                />

            </View>
        </View>
    )
}