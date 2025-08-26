import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, View, TextInput, TouchableOpacity } from "react-native";
import IconLibrary from "@/utils/icons";
import CText from "@/components/TextComp";
import UserItem from "@/utils/store/userstore.store";
import { Image } from "expo-image";
import { useThemeContext } from "@/context/ThemeContext";
import { Connection } from "@solana/web3.js";
import AppSettings from "@/utils/store/settingsstore.store";
import { api_key } from "@/app/requests/dashboard";
import Buttons from "@/components/ButtonComp";
import ConfirmActionSheet from "@/components/commons/Sheets/ConfirmationSheet";
import ButtonComp from "@/components/ButtonComp";
import TxQueue from "@/utils/store/txqueue.store";

/**
 * What should be done here
 * Show token info
 * Show amount input
 * Handle send transaction
 */
function TokenAmount() {
  const { mint, recipient, displayName } = useLocalSearchParams();
  const [token, setToken] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const { setToast } = AppSettings();

  const { userWallet } = UserItem();
  const { isDarkMode } = useThemeContext();

  useEffect(() => {
    if (mint) {
      const tokens = userWallet.tokenAccounts.filter(
        (item: any) => item.mint === mint
      );
      setToken(tokens[0]);
    }

    // Initialize Solana connection
    const network = AppSettings.getState().network;
    const conn = new Connection(`${network}${api_key}`);
    setConnection(conn);
  }, [mint]);

  const handleAmountChange = (text: string) => {
    // Only allow numbers and decimal points
    const numericValue = text.replace(/[^0-9.]/g, "");

    // Ensure only one decimal point
    const parts = numericValue.split(".");
    if (parts.length > 2) return;

    // Limit decimal places based on token decimals
    if (parts.length === 2 && parts[1].length > token?.decimals) return;

    setAmount(numericValue);
  };

  const setMaxAmount = () => {
    if (token) {
      setAmount(token.balance.toString());
    }
  };

  const getUsdValue = () => {
    if (!amount || !token) return "0.00";
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return "0.00";

    const usdValue = numAmount * (token.usdc_price / token.balance);
    return `$${usdValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  };

  const handleSend = async () => {
    if (!token || !amount || !connection || !recipient) {
      setToast("Please fill in all required fields", "error");
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setToast("Please enter a valid amount", "error");
      return;
    }

    if (numAmount > token.balance) {
      setToast("Insufficient balance", "error");
      return;
    }

    // Additional validation to prevent disabled button clicks
    if (
      !amount ||
      parseFloat(amount) <= 0 ||
      parseFloat(amount) > token.balance
    ) {
      return;
    }

    // Show confirmation sheet
    setShowConfirmation(true);
  };

  const executeTransaction = () => {
    try {
      const numAmount = parseFloat(amount);
      const isSol =
        token.mint === "So11111111111111111111111111111111111111112";
      const id = TxQueue.getState().enqueue(
        isSol
          ? {
              kind: "sol",
              recipient: recipient as string,
              amount: numAmount,
            }
          : {
              kind: "spl",
              recipient: recipient as string,
              mint: token.mint,
              amount: numAmount,
              decimals: token.decimals,
              symbol: token.symbol,
            }
      );

      router.push({
        pathname: "/dashboard/sendstatus",
        params: {
          id,
          amount: amount,
          recipient: recipient as string,
          tokenName: token.symbol,
          displayName: displayName || (recipient as string),
          mint: token.mint,
        },
      });
    } catch (error) {
      console.error("Queue error:", error);
      setToast("Failed to start transaction. Please try again.", "error");
    }
  };

  if (!token) {
    return (
      <View className="relative w-full bg-grey dark:bg-dark flex-1 py-4 items-center justify-center">
        <CText>Loading token...</CText>
      </View>
    );
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
        {/* Recipient Display */}
        <View className="bg-white dark:bg-accent rounded-xl p-4 mb-6">
          <CText className="text-[14px] text-gray-600 dark:text-gray-300 mb-2">
            Recipient
          </CText>
          <CText
            className="text-[16px] font-mono"
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {displayName || recipient}
          </CText>
          {displayName && displayName !== recipient && (
            <CText
              className="text-[12px] text-gray-500 dark:text-gray-400 mt-1 font-mono"
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {recipient}
            </CText>
          )}
        </View>

        <View className="p-2 rounded-xl bg-white dark:bg-accent2">
          {/* Amount Input */}
          <View className="mb-6">
            <View className="p-2">
              <TextInput
                className="text-[40px] text-black dark:text-white text-start mb-2"
                value={amount}
                onChangeText={handleAmountChange}
                placeholder={`0.00 ${token?.symbol}`}
                placeholderTextColor={isDarkMode ? "#9CA3AF" : "#6B7280"}
                keyboardType="numeric"
                autoFocus
              />
              <CText className="text-start text-[20px] text-gray-600 dark:text-gray-300">
                {getUsdValue()}
              </CText>
            </View>
          </View>

          {/* Available Balance */}
          <View className="bg-white dark:bg-accent rounded-xl p-4 mb-6 flex-row items-center justify-between">
            <View>
              <CText className="text-[20px] ">
                {token?.balance < 1
                  ? token?.balance?.toFixed(Math.min(token?.decimals, 5))
                  : token?.balance.toFixed(Math.min(token?.decimals, 3))}{" "}
                {token.symbol}
              </CText>
              <CText className="text-[14px] text-gray-600 dark:text-gray-300">
                Available Balance
              </CText>
            </View>
            <TouchableOpacity
              onPress={setMaxAmount}
              className="bg-[#971BB2] px-4 py-2 rounded-lg"
            >
              <CText
                className="text-white text-[14px]"
                style={{ fontFamily: "bold" }}
              >
                MAX
              </CText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Send Button */}
        <View className="mt-auto pb-6">
          <ButtonComp
            text={`Send ${amount} ${token?.symbol}`}
            onPress={handleSend}
            type="primary"
            loading={isLoading}
            disabled={
              !amount ||
              parseFloat(amount) <= 0 ||
              parseFloat(amount) > token.balance
            }
          />
        </View>
      </View>

      {/* Confirmation Sheet */}
      <ConfirmActionSheet
        open={showConfirmation}
        close={setShowConfirmation}
        title="Confirm Transaction"
        subtitle={`Send ${amount} ${token?.symbol} to ${
          displayName || (recipient as string).substring(0, 20) + "..."
        }\n\nAmount: ${amount} ${token?.symbol}\nUSD Value: ${getUsdValue()}`}
        actionNo={() => setShowConfirmation(false)}
        actionYes={() => {
          setShowConfirmation(false);
          executeTransaction();
        }}
      />
    </View>
  );
}

export default TokenAmount;

