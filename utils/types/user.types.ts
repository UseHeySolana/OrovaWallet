interface UserType {
    username: string
    mobileNumber: string,
    pin: string,
    wallet_address?: string,
    wallet_type?: "local" | "mpc" | string,
    profileImageUri?: string,
    email?: string,
}



export {
    UserType,
}