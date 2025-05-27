import Convo from '@/misc/store/conversation';
import AppSettings from '@/misc/store/settingsstore';
import * as Clipboard from 'expo-clipboard';

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


export {
    copyItem,
    pasteItem,
    delay,
    completeConversation
}
