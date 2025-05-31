import Convo from '@/misc/store/conversation';
import AppSettings from '@/misc/store/settingsstore';
import * as Clipboard from 'expo-clipboard';
import { fetchData } from '../db';
import PersonalContacts from '@/misc/store/personalcontacts';
import PhoneBook from '@/misc/store/phonebook';
import UserItem from '@/misc/store/userstore';

const copyItem = async (text: string) => {
    console.log('copy')
    try {
        await Clipboard.setStringAsync(text);
        return true
    } catch (e) {
        console.log(e)
        return false
    }
}
const pasteItem = async () => {
    try {
        const has = await Clipboard.hasStringAsync();
        if (has) {
            const text = await Clipboard.getStringAsync();
            return text
        } else {
            console.log("Clipboard is empty");
            return ""
        }
    } catch (e) {
        return ""
    }
}

const delay = (delay: number) => {

    setTimeout(() => {

    }, delay);
}

const completeConversation = async (messageId: string | null, status: "complete" | "failed" | "pending", link?: string) => {
    if (messageId !== null) {
        Convo.getState().updateMessage(messageId, {
            status: status,
            link: link
        })
    }
}

const getUserDetails = async (username: string) => {
    const users = await fetchData()
    const filtered = users.filter(
        (msg: any) =>
            msg.username.toLowerCase().includes(username.toLowerCase())
    );
    const personalContacts = PersonalContacts.getState().personalContacts
    const filteredPersonalContacts = personalContacts.filter(
        (item: any) =>
            item.username.toLowerCase() === username.toLowerCase()
    );
    if (filtered.length > 0) {
        return filtered[0]
    } else if (filteredPersonalContacts.length > 0) {
        return filteredPersonalContacts[0]
    } else {
        return null
    }
}


const AgentContacts = () =>{

    const phoneBookContacts = PhoneBook.getState().contacts.map(item => ({
        "name": item.name,
    }))
    const personalContacts = PersonalContacts.getState().personalContacts.map(item => ({
        "name": item.username,
    }))
    return [...phoneBookContacts, ...personalContacts]
    
}


// const AgentContacts = [...PhoneBook.getState().contacts.map(item => ({
//     "name": item.name,
// })), ...PersonalContacts.getState().personalContacts.map(item => ({
//     "name": item.username,
// }))]

const verifiedTokens = [
    {
        "name": "Solana",
        "address": "So11111111111111111111111111111111111111112",
        "symbol": "SOL",
        "decimals": 9,
        "logo": "https://assets.coingecko.com/coins/images/4128/large/solana.png?1640133422"
    },
    {
        "name": "USDC",
        "address": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        "symbol": "USDC",
        "decimals": 6,
        "logo": "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png?1547042194"
    },
    {
        "name": "USDT",
        "address": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
        "symbol": "USDT",
        "decimals": 6,
        "logo": "https://assets.coingecko.com/coins/images/325/large/Tether.png?1696501580"
    },
    {
        "name": "Bonk",
        "address": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
        "symbol": "Bonk",
        "decimals": 5,
        "logo": "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I"
    },
    {
        "name": "Metaplex Token",
        "address": "METAewgxyPbgwsseH8T16a39CQ5VyVxZi9zXiDPY18m",
        "symbol": "MPLX",
        "decimals": 6,
        "logo": "https://arweave.net/VRKOcXIvCxqp35RZ9I0-bDGk5qNfT46OTho-2oP9iGc"
    }
]
const supportedTokens = verifiedTokens.map(item => ({
    "name": item.symbol,
}))

const getInTokenBalance = (token: string) => {
    const userWallet = UserItem.getState().userWallet
    return userWallet.tokenAccounts.find((item: any) => item.symbol.toLowerCase() === token.toLowerCase())?.balance ?? 0
}

export {
    copyItem,
    pasteItem,
    delay,
    completeConversation,
    getUserDetails,
    AgentContacts,
    supportedTokens,
    getInTokenBalance,
    verifiedTokens
}
