
const cleanNumber = (input: any) => {
    // Remove non-digit characters
    let cleaned = input.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
        cleaned = cleaned.slice(1);
    }
    console.log(cleaned)
    return cleaned

}

export {
    cleanNumber
}