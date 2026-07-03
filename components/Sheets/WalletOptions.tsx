import { Pressable, View } from "react-native";
import { router } from "expo-router";
import DragableSheet from "../CustomItems/DragableSheet";
import { CText } from "../TextComp";
import { Image } from "expo-image";
import IconLibrary from "@/utils/icons";

interface WalletSheetTypes {
  open: boolean;
  onRestoreFromGoogle?: () => void;
  /** Phone users without email + backup keep create / import until migrated. */
  showLegacyOptions?: boolean;
  onCreateWallet?: () => void;
}

const WalletSheet = ({
  open,
  onRestoreFromGoogle,
  showLegacyOptions = false,
  onCreateWallet,
}: WalletSheetTypes) => {
  if (!open) return null;

  const snapHeight = showLegacyOptions
    ? onRestoreFromGoogle
      ? "78%"
      : "70%"
    : "52%";

  return (
    <DragableSheet
      snapPoints={[snapHeight]}
      child={
        <View className="w-full h-fit gap-y-5 flex-1 flex-col justify-between">
          <CText style={{ fontFamily: "bold" }} className="text-[1.1rem] text-center">
            {showLegacyOptions ? "Get your wallet back" : "Restore your wallet"}
          </CText>
          {showLegacyOptions ? (
            <CText className="text-center text-gray-500 dark:text-gray-400 text-sm px-3">
              Import your existing phrase, or connect email and back up to Google Drive
              so you can restore on a new phone next time.
            </CText>
          ) : null}
          <View className="flex m-auto justify-center items-center py-2">
            <Image
              style={{ height: 185, width: 300 }}
              source={require("@/assets/items/wallet.png")}
              alt="Wallet"
              contentFit="contain"
            />
          </View>
          <View className="py-4 gap-y-4">
            {onRestoreFromGoogle ? (
              <Pressable onPress={onRestoreFromGoogle}>
                <View className="flex flex-row justify-start items-center px-5 bg-grey dark:bg-accent2 py-3 rounded-full gap-x-3">
                  <View className="bg-white dark:bg-accent rounded-full p-1">
                    <IconLibrary.pluscircle />
                  </View>
                  <View>
                    <CText
                      style={{ fontFamily: "bold" }}
                      className="text-primary text-[1.1rem] font-dmBold text-start"
                    >
                      Restore from Google Drive
                    </CText>
                    <CText className="text-primary text-[1rem] text-start">
                      Use your encrypted Google backup
                    </CText>
                  </View>
                </View>
              </Pressable>
            ) : null}

            {showLegacyOptions ? (
              <>
                <Pressable onPress={() => router.push("/auth/importphrase")}>
                  <View className="flex flex-row justify-start items-center px-5 bg-grey dark:bg-accent2 py-3 rounded-full gap-x-3">
                    <View className="bg-white dark:bg-accent rounded-full p-1">
                      <IconLibrary.arrowdown />
                    </View>
                    <View>
                      <CText
                        style={{ fontFamily: "bold" }}
                        className="text-primary text-[1.1rem] font-dmBold text-start"
                      >
                        Import with secret phrase
                      </CText>
                      <CText className="text-primary text-[1rem] text-start">
                        Enter your recovery phrase manually
                      </CText>
                    </View>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => {
                    if (onCreateWallet) {
                      onCreateWallet();
                      return;
                    }
                    router.push("/auth/secretphrase");
                  }}
                >
                  <View className="flex flex-row justify-start items-center px-5 bg-grey dark:bg-accent2 py-3 rounded-full gap-x-3">
                    <View>
                      <IconLibrary.pluscircle />
                    </View>
                    <View>
                      <CText
                        style={{ fontFamily: "bold" }}
                        className="text-primary text-[1.1rem] font-dmBold text-start"
                      >
                        Create new wallet
                      </CText>
                      <CText className="text-primary text-[1rem] text-start">
                        Start fresh if you cannot recover the old one
                      </CText>
                    </View>
                  </View>
                </Pressable>
              </>
            ) : !onRestoreFromGoogle ? (
              <CText className="text-center text-gray-500 dark:text-gray-400 px-4">
                Sign in with Google to restore your wallet from an encrypted backup.
              </CText>
            ) : null}
          </View>
        </View>
      }
    />
  );
};

export default WalletSheet;
