import { useThemeContext } from "@/misc/context/ThemeContext";
import IconLibrary from "@/misc/helpers/icons";
import { TextInput, View } from "react-native";


export default function SearchInput() {
    const { isDarkMode } = useThemeContext()

    return (
        <View className="flex flex-row justify-between items-center gap-x-2  ">
            <View
                className=" flex flex-row items-center  gap-x-2 justify-start p-4 rounded-xl  text-start  w-full bg-white dark:bg-accent"
            >
                <IconLibrary.search />
                <TextInput
                    style={{ fontFamily: "bold", fontSize: 15 }}
                    // value={""}
                    placeholder="Search"
                    className="w-full text-black dark:text-white"
                    placeholderTextColor={isDarkMode ? 'white' : 'black'}
                    numberOfLines={100}
                    onChangeText={(text) => {
                    }}
                />

            </View>
        </View>
    )
}