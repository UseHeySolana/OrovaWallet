import { router, useLocalSearchParams } from "expo-router";
import { Linking, Pressable, View, TouchableOpacity } from "react-native";
import IconLibrary from "@/utils/icons";
import CText from "@/components/TextComp";
import AppSettings from "@/utils/store/settingsstore.store";
import { invalidateWalletBalanceCache } from "@/utils/wallet/walletBalanceCache";

/**
 * What should be done here
 * Success Info Page
 * Show transaction details
 */
export default function SuccessSent() {
  const { txid, amount, recipient, tokenName, displayName } =
    useLocalSearchParams();

  const openExplorer = () => {
    if (txid) {
      const network = AppSettings.getState().networkShort;
      const explorerUrl = `https://explorer.solana.com/tx/${txid}?cluster=${network}`;
      Linking.openURL(explorerUrl);
    }
  };

  const goToDashboard = () => {
    invalidateWalletBalanceCache();
    router.replace("/dashboard");
  };

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
        <CText className="text-[1.4rem]">Transaction Success</CText>
      </View>

      <View className="px-4 flex-1">
        {/* Success Icon */}
        <View className="items-center mb-8">
          <View className="w-24 h-24 bg-green-500 rounded-full items-center justify-center mb-4">
            <IconLibrary.check size={48} color="white" />
          </View>
          <CText
            className="text-[24px] text-center"
            style={{ fontFamily: "bold" }}
          >
            Transaction Sent Successfully!
          </CText>
          <CText className="text-[16px] text-center text-gray-600 dark:text-gray-300 mt-2">
            Your {tokenName || "tokens"} have been sent
          </CText>
        </View>

        {/* Transaction Details */}
        <View className="bg-white dark:bg-accent rounded-xl p-6 mb-6">
          <CText className="text-[18px] mb-4" style={{ fontFamily: "bold" }}>
            Transaction Details
          </CText>

          <View className="space-y-4">
            <View className="flex-row justify-between items-center gap-x-3">
              <CText className="text-gray-600 dark:text-gray-300">Amount</CText>
              <CText
                className="text-right flex-1"
                style={{ fontFamily: "bold" }}
                numberOfLines={1}
              >
                {amount} {tokenName || "tokens"}
              </CText>
            </View>

            <View className="flex-row justify-between items-center gap-x-3">
              <CText className="text-gray-600 dark:text-gray-300">
                Recipient
              </CText>
              <CText
                className="text-right font-mono flex-1"
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {displayName || recipient}
              </CText>
            </View>
            {displayName && displayName !== recipient && (
              <View className="flex-row justify-between items-center gap-x-3">
                <CText className="text-gray-600 dark:text-gray-300">
                  Wallet Address
                </CText>
                <CText
                  className="text-right font-mono text-[12px] flex-1"
                  numberOfLines={1}
                  ellipsizeMode="middle"
                >
                  {recipient}
                </CText>
              </View>
            )}

            <View className="flex-row justify-between items-center gap-x-3">
              <CText className="text-gray-600 dark:text-gray-300">
                Transaction ID
              </CText>
              <CText
                className="text-right font-mono text-[12px] flex-1"
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {txid}
              </CText>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View className="gap-y-4 mb-6">
          <TouchableOpacity
            onPress={openExplorer}
            className="bg-blue-500 py-4 rounded-xl"
          >
            <CText
              className="text-white text-center text-[16px]"
              style={{ fontFamily: "bold" }}
            >
              View on Explorer
            </CText>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={goToDashboard}
            className="bg-[#971BB2] py-4 rounded-xl"
          >
            <CText
              className="text-white text-center text-[16px]"
              style={{ fontFamily: "bold" }}
            >
              Back to Dashboard
            </CText>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
