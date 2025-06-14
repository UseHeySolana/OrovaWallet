import { request } from "./db";
import { AIRBILLS } from "./constant";


const airBills = {
    /**
     * 
     * @param phone_number 
     * @param amount 
     * @param token 
     * @param userWalletAddress 
     * @returns 
     */
    purchaseAirtime: async (phone_number: string, amount: number, userWalletAddress: string) => {

        const url = 'https://vendor.airbillspay.com/bills/airtime/paypoint'
        const data = {
            "phoneNumber": phone_number,
            "amount": amount,
            "token": 'USDC',
            "user_address": userWalletAddress,
        }

        try {
            const response = await request.postJsonRan(data, url, { "secretkey": AIRBILLS });

            if (!response.ok) {
                const result = await response.json();
                return {
                    status: false, message: result.message
                }
            }
            return { status: true, data: await response.json() };
        } catch (error) {
            console.log(error)
            return { status: false, message: error };
        }
    },

    getAirtimePrice: async (amount: number) => {
        const url = `https://vendor.airbillspay.com/bills/amount/usd?amount=${amount}`
        const response = await request.getRan(url, { "secretkey": AIRBILLS })
        if (!response.ok) {
            const result = await response.json()
            return { status: false, message: result.message }
        }
        return { status: true, data: await response.json() };
    },



    /**
     * 
     * @param id 
     * @returns 
     */
    completePurchase: async (id: string) => {
        const url = "https://vendor.airbillspay.com/bills/airtime/paypoint/complete"

        const data = {
            "id": id,
        }

        try {
            const response = await request.postJsonRan(data, url, { "secretkey": AIRBILLS });

            const result = await response.json();
            if (!result.success) {
                return {
                    status: false, message: result.message
                }
            }
            return { status: true, data: result };
        } catch (error) {
            console.log(error)
            return { status: false, message: error };
        }

    }

}


export {
    airBills
}