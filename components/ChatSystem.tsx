import { Image } from "expo-image";
import { View } from "react-native";

  const ChatScreen = () => (
    <View className='h-full absolute w-full z-50 bg-white/55 flex justify-center items-center '>
      <Image source={require('@/assets/images/splaash.gif')} alt="Security image" style={{ height: 70, width: 70 }} contentFit="contain" />
    </View>
  );