import React, { useState } from "react";
import { Pressable, Switch, View } from "react-native";
import CText from "@/components/TextComp";
import AppSettings from "@/utils/store/settingsstore.store";
import { router } from "expo-router";
import UserItem from "@/utils/store/userstore.store";

import IconLibrary from "@/utils/icons";
import { useThemeContext } from "@/context/ThemeContext";
import SetPin from "@/components/Sheets/SetPinSheet";
import { confirm } from "@/services/confirmation";
import { requestAccountDeletion } from "@/utils/request/db";

const settingsMenu2 = [
  {
    title: "Biometric Signin",
    route: "dark",
    type: "toggle",
    subtitle: "Use fingerprint and faceId to signin",
    icon: <IconLibrary.lock />,
  },
  {
    title: "Set PIN",
    route: "dark",
    type: "activate",
    subtitle: "Set a PIN to secure your account",
    icon: <IconLibrary.password />,
  },
  {
    title: "Private Key",
    route: "/settings/security/private",
    subtitle: "View your private key/key phrases",
    icon: <IconLibrary.security />,
  },
  {
    title: "Delete Account",
    route: null,
    type: "delete-account",
    subtitle: "Request account deletion from Orova",
    icon: <IconLibrary.delete />,
  },
];

/**
 * What should be done here
 * 1. Updates Settings and Shows Settings and What to Change
 */
export default function Security() {
  const { setToast, openWithAuth, setOpenWithAuth, pin, setLoading } =
    AppSettings();
  const { user, logout } = UserItem();
  const [setPinOpen, setSetPinOpen] = useState<boolean>(false);

  const submitDeleteRequest = async () => {
    if (!user?.username) {
      setToast("Sign in again to request account deletion", "error");
      return;
    }

    const confirmed = await confirm({
      message: "Request account deletion?",
      subtitle:
        "Your account deletion request will be submitted. Your account will be deleted within the next few days.",
    });
    if (!confirmed) return;

    setLoading(true);
    try {
      const response = await requestAccountDeletion({
        username: user.username,
        wallet_address: user.wallet_address || undefined,
        email: user.email || undefined,
        phone_number: user.phoneE164 || user.mobileNumber || undefined,
      });

      if (response.status === false) {
        setToast(response.message, "error");
        return;
      }

      setToast(response.message, "success");
      logout();
      router.replace("/auth/login");
    } finally {
      setLoading(false);
    }
  };

  const routeNavigation = async (route: any, type?: string) => {
    if (type === "toggle") {
      return;
    }
    if (type === "activate") {
      setSetPinOpen(!setPinOpen);
      return;
    }
    if (type === "delete-account") {
      await submitDeleteRequest();
      return;
    }
    if (route == null) {
      return;
    }
    if (route == "logout") {
      logout();
      router.replace("/auth/login");
      return;
    }
    if (route !== null) {
      router.push(route);
    }
  };

  return (
    <View className="relative pt-3 bg-grey dark:bg-dark  w-100 flex-1 items-start justify-start gap-y-4">
      <View className="w-full gap-y-6">
        <View className="w-full px-4 flex flex-row justify-start items-center gap-x-5">
          <Pressable
            onPress={() => router.back()}
            className="p-3 rounded-full bg-white dark:bg-accent"
          >
            <IconLibrary.back />
          </Pressable>
          <CText className="text-[1.4rem]">Security</CText>
        </View>

        <View className="w-11/12  m-auto p-4 gap-y-4  rounded-2xl shadow-sm     bg-white dark:bg-accent ">
          {settingsMenu2.map((item, index) => {
            return (
              <Pressable
                onPress={() => {
                  routeNavigation(item.route, item.type);
                }}
                key={index}
                className="py-1 flex flex-row justify-between items-center"
              >
                <View className="flex-1 flex-row justify-start items-center gap-x-2">
                  <View className="h-6 flex flex-row justify-center items-center w-6">
                    {item.icon ? item.icon : <IconLibrary.angle_right />}
                  </View>
                  <View className="flex-1">
                    <CText className="text-[1.2rem]">{item.title}</CText>
                    <CText textColor="text-gray-400" className="text-[1rem] ">
                      {item.subtitle}
                    </CText>
                  </View>
                </View>

                {(item.route && item.route !== "logout") ||
                item.type === "delete-account" ? (
                  <>
                    {item.type === "toggle" ? (
                      <Switch
                        trackColor={{ false: "red", true: "green" }}
                        thumbColor={"white"}
                        ios_backgroundColor="#3e3e3e"
                        onValueChange={() => {
                          if (pin === "") {
                            setToast("Please set a PIN first", "error");
                            setSetPinOpen(true);
                            return;
                          }
                          setOpenWithAuth(!openWithAuth);
                          if (!openWithAuth) {
                            setToast("Biometric signin activated", "success");
                          } else {
                            setToast("Biometric signin deactivated", "info");
                          }
                        }}
                        value={Boolean(openWithAuth)}
                      />
                    ) : (
                      <View className="p-3">
                        <IconLibrary.angle_right />
                      </View>
                    )}
                  </>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <SetPin open={setPinOpen} setOpen={setSetPinOpen} />
    </View>
  );
}
