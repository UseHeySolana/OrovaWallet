import { fetchConversionRate, fetchTokenAccounts, getBalance } from "@/misc/helpers/wallet";
import { UserType } from "@/misc/types/usertypes";
import { Connection, PublicKey } from "@solana/web3.js";

export const api_key = process.env.EXPO_PUBLIC_HELIUS_API || "";

const setUserItems = async (user: UserType, updateUserWallet: any, publicKey: PublicKey, network: string) => {

    const connection = new Connection(`${network}${api_key}`);
    const pubConvert = new PublicKey(publicKey);
    try {
        if (user) {
            const Solbalance = await getBalance(pubConvert, connection);
            const rate = await fetchConversionRate("So11111111111111111111111111111111111111112");
            const balance = Number(Solbalance) * rate;
            let usdBalance = balance;

            const sol = {
                name: "Solana",
                image: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
                symbol: "SOL",
                balance: Solbalance,
                decimals: 9,
                usdc_price: balance,
                mint: 'So11111111111111111111111111111111111111112',
            };

            const tokens = await fetchTokenAccounts(pubConvert, network)
            const fungible = tokens.result.items.filter((item: any) => item.interface === "FungibleToken").map((token: any) => {
                const tokenInfo = token?.token_info;
                const content = token?.content?.metadata;
                usdBalance +=
                    tokenInfo?.price_info?.total_price == undefined
                        ? 0
                        : tokenInfo?.price_info?.total_price;
                return {
                    name: content?.name,
                    image: token?.content?.links?.image,
                    symbol: content?.symbol,
                    balance:
                        tokenInfo?.balance * Math.pow(10, -tokenInfo?.decimals),
                    decimals: tokenInfo?.decimals,
                    usdc_price: tokenInfo?.price_info?.total_price,
                    mint: token?.id,
                };
            });
            fungible.unshift(sol)

            updateUserWallet({
                balance: Number(balance.toFixed(2)),
                solBalance: Number(Solbalance?.toFixed(4)),
                tokenAccounts: tokens ? fungible : [sol],
                totalUsdBalance: usdBalance,
            });



        }

    } catch (error) {
        console.log("Error fetching user data", error);
    }
}


export default setUserItems