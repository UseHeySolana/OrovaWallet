import React, { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import CText from "@/components/TextComp";
import { Image } from "expo-image";
import { router } from "expo-router";
import UserItem from "@/utils/store/userstore.store";
import IconLibrary from "@/utils/icons";
import { useThemeContext } from "@/context/ThemeContext";
import Buttons from "@/components/ButtonComp";
import AppSettings from "@/utils/store/settingsstore.store";
import * as ImagePicker from "expo-image-picker";
import { Directory, File, Paths } from "expo-file-system";

const PROFILE_IMAGE_DIR = new Directory(Paths.document, "profile-images");

const getImageExtension = (uri: string) => {
  const path = uri.split("?")[0];
  const extension = path.split(".").pop();
  return extension && extension.length <= 5 ? extension : "jpg";
};

const persistProfileImage = async (uri: string) => {
  if (!PROFILE_IMAGE_DIR.exists) {
    PROFILE_IMAGE_DIR.create({
      intermediates: true,
      idempotent: true,
    });
  }

  const source = new File(uri);
  const destination = new File(
    PROFILE_IMAGE_DIR,
    `profile-${Date.now()}.${getImageExtension(uri)}`
  );
  source.copy(destination);
  return destination.uri;
};

export default function Account() {
  const { user, setUser } = UserItem();
  const { isDarkMode } = useThemeContext();
  const { setToast } = AppSettings();

  const [username, setUsername] = useState(user?.username ?? "");
  const [profileImageUri, setProfileImageUri] = useState(
    user?.profileImageUri ?? ""
  );
  const [email, setEmail] = useState(user?.email ?? "");

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setProfileImageUri(user.profileImageUri ?? "");
      setEmail(user.email ?? "");
    }
  }, [user]);

  const pickImage = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        setToast("Permission to access photos is required", "error");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const uri = await persistProfileImage(result.assets[0].uri);
        setProfileImageUri(uri);
        const currentUser = UserItem.getState().user;
        if (!currentUser) return;
        setUser({
          ...currentUser,
          profileImageUri: uri,
        });
        setToast("Profile picture updated", "success");
      }
    } catch {
      setToast("Failed to pick image", "error");
    }
  };

  const saveUsername = () => {
    const trimmed = username.trim();
    if (!trimmed) {
      setToast("Username cannot be empty", "error");
      return;
    }
    if (!user) return;
    const currentUser = UserItem.getState().user;
    if (!currentUser) return;
    setUser({
      ...currentUser,
      username: trimmed,
    });
    setToast("Username updated", "success");
  };

  const saveEmail = () => {
    const trimmed = email.trim();
    if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setToast("Please enter a valid email", "error");
      return;
    }
    if (!user) return;
    const currentUser = UserItem.getState().user;
    if (!currentUser) return;
    setUser({
      ...currentUser,
      email: trimmed || undefined,
    });
    setToast(trimmed ? "Email saved for backup recovery" : "Email removed", "success");
  };

  return (
    <View className="flex-1 bg-grey dark:bg-dark pt-3">
      <View className="w-full px-4 flex flex-row justify-start mb-4">
        <Pressable
          onPress={() => router.back()}
          className="p-3 rounded-full bg-white dark:bg-accent"
        >
          <IconLibrary.back />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="w-11/12 m-auto gap-y-6">
          {/* Profile picture */}
          <View className="bg-white dark:bg-accent rounded-2xl p-6 items-center shadow-sm">
            <CText
              style={{ fontFamily: "bold" }}
              className="text-lg text-dark dark:text-white mb-4"
            >
              Profile picture
            </CText>
            <TouchableOpacity
              onPress={pickImage}
              activeOpacity={0.8}
              className="rounded-full overflow-hidden border-4 border-purple"
              style={{ width: 120, height: 120 }}
            >
              {profileImageUri ? (
                <Image
                  source={{ uri: profileImageUri }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              ) : (
                <View className="w-full h-full bg-grey dark:bg-accent2 items-center justify-center">
                  <IconLibrary.pluscircle size={32} />
                </View>
              )}
            </TouchableOpacity>
            <CText className="text-gray-500 dark:text-gray-400 mt-2">
              Tap to change
            </CText>
          </View>

          {/* Username */}
          <View className="bg-white dark:bg-accent rounded-2xl p-4 shadow-sm">
            <CText
              style={{ fontFamily: "bold" }}
              className="text-base text-dark dark:text-white mb-2"
            >
              Username
            </CText>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="Your username"
              placeholderTextColor={isDarkMode ? "#9ca3af" : "#6b7280"}
              className="bg-grey dark:bg-accent2 rounded-xl px-4 py-3 text-dark dark:text-white text-[16px]"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View className="mt-3">
              <Buttons
                text="Update username"
                onPress={saveUsername}
                type="secondary"
                buttonType="feedback"
                className="rounded-full py-3"
              />
            </View>
          </View>

          {/* Email for backup / keyphrase security */}
          <View className="bg-white dark:bg-accent rounded-2xl p-4 shadow-sm">
            <CText
              style={{ fontFamily: "bold" }}
              className="text-base text-dark dark:text-white mb-1"
            >
              Backup email
            </CText>
            <CText className="text-gray-500 dark:text-gray-400 text-sm mb-2">
              Add an email to secure your keyphrase and backup data. Used only for recovery.
            </CText>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor={isDarkMode ? "#9ca3af" : "#6b7280"}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              className="bg-grey dark:bg-accent2 rounded-xl px-4 py-3 text-dark dark:text-white text-[16px]"
            />
            <View className="mt-3">
              <Buttons
                text={email ? "Save email" : "Add email"}
                onPress={saveEmail}
                type="secondary"
                buttonType="feedback"
                className="rounded-full py-3"
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
