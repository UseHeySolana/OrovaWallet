const Cookies = require('js-cookie')

export const storage = {

    get: (name: string) => {
        const storageItem = Cookies.get(name)
        return storageItem;
    },
    set: (name: string, item: string) => {
        const saved = Cookies.set(name, item)
        if (saved) {
            return true
        } else {
            return false
        };
    },
    remove: (name: string) => {
        const removed = Cookies.remove(name)
        if (removed) {
            return true
        } else {
            return false
        };
    }
}