import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import CText from "@/components/TextComp";
import { Image } from "expo-image";
import Buttons from "@/components/ButtonComp";
import { generateMnemonic, getKeypairFromMnemonic } from "@/utils/wallet";

import * as Clipboard from "expo-clipboard";
import AppSettings from "@/utils/store/settingsstore.store";
// import { Connection, Keypair } from "@solana/web3.js";
import WalletItem from "@/utils/store/wallet.store";
import { saveWalletAddress } from "@/utils/request/db";

import UserItem from "@/utils/store/userstore.store";
import { router } from "expo-router";
import IconLibrary from "@/utils/icons";
import ConfirmPhraseSheet from "@/components/Sheets/ConfirmKeyWordsSheet";
import { setWalletSecret } from "@/utils/storage/secureStore";



const actions = [
  "Hey Solana does not keep a copy of your secret phrase.",
  "Saving it digitally in text is NOT advisable. Examples include screenshots, text files or emailing yourself.",
  "Write down your secret phrase and store in a secure offline location"
]

const positionVal = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seven', 'eight', 'ninth', 'tenth', 'eleventh', 'twelveth'];


/**
  * What should be done here
  * 1. Notify what the secret phrase is for.
  * 2. Generate Secre Phrase
  * 3. Verify that they have saved phrase
  */
function getThreeRandomStrings(array: string[]) {
  // Make a copy to avoid modifying the original array
  const shuffled = [...array];

  // Shuffle array using Fisher-Yates algorithm
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Return first three elements
  return shuffled.slice(0, 3).map((i, index) => {
    return {
      position: array.indexOf(i) + 1,
      word: i
    }
  });

}
export default function SecretPhrase({ navigation }: any) {
  const [currentState, setCurrentState] = useState<'verify-phrase' | "start-wallet" | "sign-up" | "set-pin" | "">('')
  const [startWalletCreation, setStartWalletCreation] = useState(false);
  const [verifyPhrase, setVerifyPhrase] = useState(false);
  // const { showToast } =
  const [mnemonic, setMnemonic] = useState("");
  const [verifiedWords, setVerifiedWords] = useState<{ position: number, word: string }[]>([]);
  const [userWords, setUserWords] = useState(
    [
      {
        position: 0,
        word: "",
      },
      {
        position: 0,
        word: "",
      },
      {
        position: 0,
        word: "",
      }
    ]
  )

  const { keypair, updateKeypair, publicKey, updatePassphrase } = WalletItem();
  const { user } = UserItem();
  const { setLoading, isLoading, setToast } = AppSettings()


  const generateKeyPhrase = async () => {
    setLoading(true)
    const phrase = await generateMnemonic();
    if (phrase) {

      setMnemonic(phrase);
      setStartWalletCreation(true)
      setLoading(false)

    } else {
      setLoading(false)
    }
  }

  const copyKeyPhrase = async () => {
    setLoading(true)
    await Clipboard.setStringAsync(mnemonic);
    setVerifiedWords(getThreeRandomStrings(mnemonic.split(' ') as string[]))
    setTimeout(() => {
      setCurrentState("verify-phrase");
    }, 500);
    setTimeout(() => {
      setLoading(false)
    }, 1000)
  }
  const validatePhrase = async () => {

    if (userWords.some(word => !word.word.trim())) {
      setToast("Please fill in all the words", "error");
      return;
    }
    setLoading(true)
    // Check if each entered word matches the corresponding verified word
    const isCorrect = userWords.every((userWord, index) => {
      const verifiedWord = verifiedWords[index];
      // Compare the words case-insensitively
      return userWord.word.toLowerCase().trim() === verifiedWord.word.toLowerCase();
    });



    if (!isCorrect) {
      setToast("Some words don't match. Please check and try again.", "error");
      setLoading(false)
      return;
    } else {

      try {
        setCurrentState('set-pin');
        const keyPair = await getKeypairFromMnemonic(mnemonic);
        try {
          await setWalletSecret(mnemonic);
        } catch (e) {
          setLoading(false);
          setToast("Could not save your phrase securely on this device.", "error");
          console.error("setWalletSecret failed:", e);
          return;
        }
        updateKeypair(keyPair);
        updatePassphrase(mnemonic);

        if (!user) {
          router.replace('/auth/username')
          return
        }
        const response = await saveWalletAddress(keyPair.publicKey.toBase58(), user.username)
        if (response.status !== false) {
          setToast("Wallet Created", 'success')
          router.replace('/dashboard')
          setLoading(false)
        }
        setLoading(false)
      } catch (error) {
        setLoading(false)
        console.error("Error generating keypair:", error);
      }
    }
  }
  /**
   * sudo port install php82-cgi php82-gd php82-curl php82-intl php82-iconv php82-gettext php82-mbstring php82-imap php82-mcrypt php82-xmlrpc php82-mysql php82-openssl php82-sockets php82-zip php82-tidy php82-opcache php82-xsl php82-sqlite
   */

  return (
    <View className="py-10 relative bg-grey dark:bg-dark  h-[100%]">
      {!startWalletCreation ? (
        <ScrollView
          className="gap-y-5"
          contentContainerStyle={{ paddingBottom: 100, gap: 10 }}
        >
          <View className="w-11/12 m-auto bg-white dark:bg-accent rounded-3xl p-10">
            <View className="gap-x-5">
              <CText
                style={{ fontFamily: "bold" }}
                className="text-[24px] text-center"
              >
                Your secret phrase is the master key to your wallet
              </CText>
              <CText className="text-[16px] text-center">
                Read the context below carefully in order to be able to properly
                safeguard your wallet.
              </CText>
            </View>

            <View className="w-100 m-auto">
              <Image
                source={require("@/assets/items/secret.png")}
                alt="Security image"
                style={{ height: 221, width: 221 }}
                contentFit="contain"
              />
            </View>
          </View>

          <View className="w-11/12 m-auto bg-white dark:bg-accent gap-y-3 rounded-3xl p-3">
            {actions.map((action, index) => {
              return (
                <View
                  key={index}
                  className="bg-grey dark:bg-accent2 rounded-3xl p-4 flex flex-row  gap-x-2 justify-start items-start"
                >
                  <View className="h-5 w-5 border-4 border-purple rounded-full"></View>
                  <View className="w-[288px] ">
                    <CText className="text-[16px] text-start text-wrap">
                      {action}
                    </CText>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      ) : (
        <View className="gap-y-5">
          <View className="w-11/12 m-auto bg-white dark:bg-accent rounded-3xl gap-y-4 px-4 py-3">
            <View className="gap-y-4 mb-2">
              <CText
                style={{ fontFamily: "bold" }}
                className="text-[24px] text-start"
              >
                Secret Phrase
              </CText>
              <CText className="text-[16px] text-start">Write this down</CText>
            </View>
            <View className="w-full m-auto bg-grey dark:bg-accent2 rounded-3xl">
              <View className="p-7 flex flex-row flex-wrap gap-2 justify-between items-center">
                {mnemonic.split(" ").map((word, index) => {
                  return (
                    <CText
                      key={index}
                      style={{ fontFamily: "bold" }}
                      className="text-[16px] basis-1/4 "
                    >
                      {verifiedWords.length > 0
                        ? "*****"
                        : `${index + 1}. ${word}`}
                    </CText>
                  );
                })}
              </View>
            </View>
            <Buttons
              buttonType="feedback"
              onPress={() => copyKeyPhrase()}
              className=""
              icon={<IconLibrary.copy />}
              text="Copy secret phrase"
              type="secondary"
            />
          </View>
        </View>
      )}
      <View className="w-full px-4 m-auto p-2 gap-y-3 bottom-10 absolute">
        {!startWalletCreation && (
          <Buttons
            onPress={() => {
              generateKeyPhrase();
            }}
            text="Continue"
          />
        )}
      </View>

      <ConfirmPhraseSheet
        open={currentState === "verify-phrase"}
        verifiedWords={verifiedWords}
        userWords={userWords}
        copyKeyPhrase={copyKeyPhrase}
        positionVal={positionVal}
        setUserWords={(words) => setUserWords(words)}
        currentState={currentState}
        validatePhrase={validatePhrase}
      />
    </View>
  );
}


