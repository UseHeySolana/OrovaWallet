interface UserType {
    username: string
    mobileNumber: string,
    /** Full international number used for push/API (e.g. +2348012345678) */
    phoneE164?: string,
    pin: string,
    wallet_address?: string,
    profileImageUri?: string,
    email?: string,
}



export {
    UserType,
}