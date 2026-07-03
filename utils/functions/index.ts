import Convo from "@/utils/store/conversation.store";
import AppSettings from "@/utils/store/settingsstore.store";
import * as Clipboard from "expo-clipboard";
import { fetchData } from "@/utils/request/db";
import PersonalContacts from "@/utils/store/personalcontacts.store";
import PhoneBook from "@/utils/store/phonebook.store";
import UserItem from "@/utils/store/userstore.store";

const copyItem = async (text: string) => {
  console.log("copy");
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch (e) {
    console.log(e);
    return false;
  }
};
const pasteItem = async () => {
  try {
    const has = await Clipboard.hasStringAsync();
    if (has) {
      const text = await Clipboard.getStringAsync();
      return text;
    } else {
      console.log("Clipboard is empty");
      return "";
    }
  } catch (e) {
    return "";
  }
};

const delay = async (delayMs: number) => {
  /** @deprecated Prefer explicit setLoading + sleep; this toggles the global loader independently. */
  AppSettings.getState().setLoading(true);
  setTimeout(() => {
    AppSettings.getState().setLoading(false);
  }, delayMs);
};

const delayPromise = (ms: number): Promise<void> => {
  AppSettings.getState().setLoading(true);
  return new Promise((resolve) => {
    setTimeout(() => {
      AppSettings.getState().setLoading(false);
      resolve();
    }, ms);
  });
};

const completeConversation = async (
  messageId: string | null,
  status: "complete" | "failed" | "pending",
  link?: string
) => {
  if (messageId !== null) {
    const msg = Convo.getState().messages.find((m) => m.id === messageId);
    Convo.getState().updateMessage({
      messageId,
      source: msg?.source ?? "voice",
      toolUpdates: {
        status: status,
        link: link,
      },
    });
  }
};

const getUserDetails = async (username: string) => {
  const users = await fetchData();
  const filtered = users.filter((msg: any) =>
    msg.username.toLowerCase().includes(username.toLowerCase())
  );
  const personalContacts = PersonalContacts.getState().personalContacts;
  const filteredPersonalContacts = personalContacts.filter(
    (item: any) => item.username.toLowerCase() === username.toLowerCase()
  );
  if (filtered.length > 0) {
    return filtered[0];
  } else if (filteredPersonalContacts.length > 0) {
    return filteredPersonalContacts[0];
  } else {
    return null;
  }
};

const AgentContacts = () => {
  const phoneBookContacts = PhoneBook.getState().contacts.map((item) => ({
    name: item.name,
  }));
  const personalContacts = PersonalContacts.getState().personalContacts.map(
    (item) => ({
      name: item.username,
    })
  );
  return [...phoneBookContacts, ...personalContacts];
};

// const AgentContacts = [...PhoneBook.getState().contacts.map(item => ({
//     "name": item.name,
// })), ...PersonalContacts.getState().personalContacts.map(item => ({
//     "name": item.username,
// }))]

export {
  bootstrapVerifiedTokensList,
  getSupportedTokenSymbolsForPrompt,
  getVerifiedTokens,
  refreshVerifiedTokensFromRemote,
  useVerifiedTokensStore,
} from "@/utils/store/verifiedTokens.store";
export type { VerifiedTokenDef } from "@/utils/tokenList/types";
export {
  resolveMetasForMints,
  resolveTokenByQuery,
  resolveTokenForSwapDisambiguation,
  searchTokenHitsV2,
  sortTokenSearchHitsForDisplay,
  tokenSearchHitsToPickerRows,
} from "@/libs/jupiter/tokensV2Search";

const getInTokenBalance = (token: string) => {
  const userWallet = UserItem.getState().userWallet;
  return (
    userWallet.tokenAccounts.find(
      (item: any) => item.symbol.toLowerCase() === token.toLowerCase()
    )?.balance ?? 0
  );
};

export {
  copyItem,
  pasteItem,
  delay,
  delayPromise,
  completeConversation,
  getUserDetails,
  AgentContacts,
  getInTokenBalance,
};
