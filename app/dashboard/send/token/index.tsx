import { useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, View, TextInput, TouchableOpacity, FlatList } from "react-native";
import IconLibrary from "@/utils/icons";
import CText from "@/components/TextComp";
import UserItem from "@/utils/store/userstore.store";
import { Image } from "expo-image";
import { useThemeContext } from "@/context/ThemeContext";
import * as Clipboard from "expo-clipboard";
import { PublicKey } from "@solana/web3.js";
import AntDesign from "@expo/vector-icons/AntDesign";
import { getUserDetails } from "@/utils/functions";
import ButtonComp from "@/components/ButtonComp";
import { SendFlowScreenSkeleton } from "@/components/skeletons";
import DragableSheet from "@/components/CustomItems/DragableSheet";
import SearchInput from "@/components/SearchInput/SearchInput";

/**
 * What should be done here
 * Send Token Info
 */
function normalizeMintParam(
  raw: string | string[] | undefined
): string | undefined {
  if (typeof raw === "string") return raw;
  return raw?.[0];
}

export default function SendToken() {
  const params = useLocalSearchParams<{ mint?: string | string[] }>();
  const mint = normalizeMintParam(params.mint);
  const [token, setToken] = useState<any>(null);
  const [tokenPickerOpen, setTokenPickerOpen] = useState(false);
  const [sheetSearchQuery, setSheetSearchQuery] = useState("");
  const [recipientInput, setRecipientInput] = useState("");
  const [isValidInput, setIsValidInput] = useState<boolean | null>(null);
  const [isCheckingInput, setIsCheckingInput] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string>("");
  const [inputType, setInputType] = useState<"address" | "username" | null>(
    null
  );

  const { userWallet } = UserItem();
  const { isDarkMode } = useThemeContext();

  const sheetTokens = userWallet?.tokenAccounts ?? [];
  const sheetQ = sheetSearchQuery.trim().toLowerCase();
  const filteredSheetTokens = useMemo(() => {
    if (!sheetQ) return sheetTokens;
    return sheetTokens.filter((t: any) => {
      const name = (t?.name ?? "").toLowerCase();
      const symbol = (t?.symbol ?? "").toLowerCase();
      const m = (t?.mint ?? "").toLowerCase();
      return name.includes(sheetQ) || symbol.includes(sheetQ) || m.includes(sheetQ);
    });
  }, [sheetTokens, sheetQ]);

  useEffect(() => {
    if (mint && userWallet?.tokenAccounts?.length) {
      const tokens = userWallet.tokenAccounts.filter(
        (item: any) => item.mint === mint
      );
      setToken(tokens[0] ?? null);
    }
  }, [mint, userWallet]);

  const closeTokenPicker = () => {
    setTokenPickerOpen(false);
    setSheetSearchQuery("");
  };

  const selectTokenFromSheet = (newMint: string) => {
    router.setParams({ mint: newMint });
    closeTokenPicker();
  };

  const validateSolanaAddress = (address: string) => {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  };

  const validateUsername = async (username: string) => {
    try {
      const userDetails = await getUserDetails(username);
      return userDetails ? userDetails.wallet_address : null;
    } catch (error) {
      console.error("Error validating username:", error);
      return null;
    }
  };

  const handleInputChange = async (text: string) => {
    setRecipientInput(text);

    if (text.length > 0) {
      setIsCheckingInput(true);

      // Check if it's a valid Solana address first
      if (validateSolanaAddress(text)) {
        setIsValidInput(true);
        setResolvedAddress(text);
        setInputType("address");
        setIsCheckingInput(false);
        return;
      }

      // If not a valid address, check if it's a username
      const walletAddress = await validateUsername(text);
      if (walletAddress) {
        setIsValidInput(true);
        setResolvedAddress(walletAddress);
        setInputType("username");
        setIsCheckingInput(false);
        return;
      }

      // If neither valid address nor username
      setIsValidInput(false);
      setResolvedAddress("");
      setInputType(null);
      setIsCheckingInput(false);
    } else {
      setIsValidInput(null);
      setResolvedAddress("");
      setInputType(null);
      setIsCheckingInput(false);
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        handleInputChange(text);
      }
    } catch (error) {
      console.error("Failed to get clipboard content:", error);
    }
  };

  const handleNext = () => {
    if (isValidInput && resolvedAddress && mint) {
      router.push({
        pathname: "/dashboard/send/token/amount",
        params: {
          mint,
          recipient: resolvedAddress,
          displayName:
            inputType === "username"
              ? recipientInput
              : resolvedAddress.substring(0, 20) + "...",
        },
      });
    }
  };

  if (!token) {
    return <SendFlowScreenSkeleton />;
  }

  return (
    <View className="relative w-full bg-grey dark:bg-dark flex-1 py-4">
      {/* Header */}
      <View className="w-full px-4 flex flex-row justify-start items-center gap-x-5 mb-6">
        <Pressable
          onPress={() => router.back()}
          className="p-3 rounded-full bg-white dark:bg-accent"
        >
          <IconLibrary.back />
        </Pressable>
        <CText className="text-[1.4rem]">Send {token?.name}</CText>
      </View>

      <View className="px-4 flex-1">
        <Pressable
          android_ripple={{ color: "#971BB2" }}
          onPress={() => setTokenPickerOpen(true)}
          className="bg-white dark:bg-accent rounded-xl p-4 mb-6 flex-row items-center justify-between active:opacity-80"
        >
          <View className="flex-row items-center gap-x-3">
            <View className="h-14 w-14 overflow-hidden rounded-full">
              <Image
                source={token?.image ?? require("@/assets/images/icon.png")}
                alt={token?.name}
                style={{ height: "100%", width: "100%" }}
                contentFit="cover"
              />
            </View>
            <View>
              <CText style={{ fontFamily: "bold" }} className="text-[18px]">
                {token?.name || "?"}
              </CText>
              <CText
                style={{ fontFamily: "reg" }}
                className="text-[16px] text-gray-600 dark:text-gray-300"
              >
                {token?.balance < 1
                  ? token?.balance?.toFixed(Math.min(token?.decimals, 5))
                  : token?.balance.toFixed(Math.min(token?.decimals, 3))}{" "}
                {token.symbol}
              </CText>
            </View>
          </View>
          <AntDesign
            name="down"
            size={20}
            color={isDarkMode ? "white" : "black"}
          />
        </Pressable>

        {/* Recipient Input */}
        <View className="mb-6 p-2 rounded-xl bg-white dark:bg-accent2">
          <View className="relative border-b border-gray-200 dark:border-gray-600">
            <TextInput
              className="rounded-xl p-4 text-[16px] text-black dark:text-white"
              value={recipientInput}
              onChangeText={handleInputChange}
              placeholder="Enter Solana address or username"
              placeholderTextColor={isDarkMode ? "#9CA3AF" : "#6B7280"}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              onPress={pasteFromClipboard}
              className="absolute right-4 top-4"
            >
              <IconLibrary.copy size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
          <View className="p-2">
            {/* Input Status */}
            {isCheckingInput && (
              <View className="flex-row items-center gap-x-2 mt-3">
                <View className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <CText className="text-blue-500">Checking...</CText>
              </View>
            )}

            {isValidInput === true && (
              <View className="flex-row items-center gap-x-2 mt-3">
                <View className="w-5 h-5 bg-green-500 rounded-full items-center justify-center">
                  <IconLibrary.check />
                </View>
                <CText className="text-green-500">
                  {inputType === "username"
                    ? `Valid username - ${recipientInput}`
                    : "Valid Solana address"}
                </CText>
              </View>
            )}

            {isValidInput === false && (
              <View className="flex-row items-center gap-x-2 mt-3">
                <View className="w-5 h-5 bg-red-500 rounded-full items-center justify-center">
                  <IconLibrary.cancel />
                </View>
                <CText className="text-red-500">
                  Invalid address or username not found
                </CText>
              </View>
            )}

            {/* Resolved Address Display */}
            {isValidInput && inputType === "username" && resolvedAddress && (
              <View className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <CText className="text-[12px] text-blue-600 dark:text-blue-400 mb-1">
                  Resolved to wallet address:
                </CText>
                <CText
                  className="text-[12px] font-mono text-blue-800 dark:text-blue-200"
                  numberOfLines={1}
                  ellipsizeMode="middle"
                >
                  {resolvedAddress}
                </CText>
              </View>
            )}
          </View>
        </View>

        {/* Next Button */}
        <View className="mt-auto pb-6">
          <ButtonComp
            text="Next"
            onPress={handleNext}
            disabled={!isValidInput || !resolvedAddress}
          />
        </View>
      </View>

      {tokenPickerOpen ? (
        <DragableSheet
          close={closeTokenPicker}
          panClose
          snapPoints={["72%", "88%"]}
          child={
            <View className="w-full flex-1 gap-y-3 pb-6">
              <CText style={{ fontFamily: "bold" }} className="text-[18px] text-center">
                Select token
              </CText>
              <SearchInput
                onSearch={setSheetSearchQuery}
                value={sheetSearchQuery}
              />
              {filteredSheetTokens.length === 0 ? (
                <View className="py-8">
                  <CText className="text-center text-gray-500 dark:text-gray-400">
                    No tokens match your search.
                  </CText>
                </View>
              ) : (
                <FlatList
                  data={filteredSheetTokens}
                  keyExtractor={(item: any) => item.mint}
                  keyboardShouldPersistTaps="handled"
                  style={{ flex: 1 }}
                  renderItem={({ item: t }: { item: any }) => {
                    const selected = t.mint === mint;
                    return (
                      <Pressable
                        android_ripple={{ color: "#971BB2" }}
                        onPress={() => selectTokenFromSheet(t.mint)}
                        className="flex-row items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700"
                      >
                        <View className="flex-row items-center gap-x-3 flex-1">
                          <View className="h-12 w-12 overflow-hidden rounded-full">
                            <Image
                              source={
                                t?.image ?? require("@/assets/images/icon.png")
                              }
                              alt={t?.name}
                              style={{ height: "100%", width: "100%" }}
                              contentFit="cover"
                            />
                          </View>
                          <View className="flex-1">
                            <CText
                              style={{ fontFamily: "bold" }}
                              className="text-[16px]"
                            >
                              {t?.name || "?"}
                            </CText>
                            <CText
                              style={{ fontFamily: "reg" }}
                              className="text-[14px] text-gray-600 dark:text-gray-300"
                            >
                              {t?.balance < 1
                                ? t?.balance?.toFixed(
                                    Math.min(t?.decimals, 5)
                                  )
                                : t?.balance.toFixed(
                                    Math.min(t?.decimals, 3)
                                  )}{" "}
                              {t.symbol}
                            </CText>
                          </View>
                        </View>
                        {selected ? (
                          <AntDesign name="check" size={20} color="#971BB2" />
                        ) : null}
                      </Pressable>
                    );
                  }}
                />
              )}
            </View>
          }
        />
      ) : null}
    </View>
  );
}
