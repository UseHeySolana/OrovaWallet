import * as Clipboard from 'expo-clipboard';

const copyItem = async (text: string) => {
    console.log('copy')
    try {
        await Clipboard.setStringAsync(text);
        return true
    } catch (e) {
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


export {
    copyItem,
    pasteItem,
    delay
}
