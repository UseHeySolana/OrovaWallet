import type { VerifiedTokenDef } from "./types";

/** Bundled defaults; merged with persisted + remote entries by mint address. */
export const DEFAULT_VERIFIED_TOKENS: VerifiedTokenDef[] = [
    {
        name: "Solana",
        address: "So11111111111111111111111111111111111111112",
        symbol: "SOL",
        decimals: 9,
        logo: "https://assets.coingecko.com/coins/images/4128/large/solana.png?1640133422",
    },
    {
        name: "USDC",
        address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        symbol: "USDC",
        decimals: 6,
        logo: "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png?1547042194",
    },
    {
        name: "USDT",
        address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
        symbol: "USDT",
        decimals: 6,
        logo: "https://assets.coingecko.com/coins/images/325/large/Tether.png?1696501580",
    },
    {
        name: "Bonk",
        address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
        symbol: "Bonk",
        decimals: 5,
        logo: "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I",
    },
    {
        name: "Metaplex Token",
        address: "METAewgxyPbgwsseH8T16a39CQ5VyVxZi9zXiDPY18m",
        symbol: "MPLX",
        decimals: 6,
        logo: "https://arweave.net/VRKOcXIvCxqp35RZ9I0-bDGk5qNfT46OTho-2oP9iGc",
    },
    {
        name: "Tesla xStock",
        address: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB",
        symbol: "TSLAX",
        decimals: 8,
        logo: "https://xstocks-metadata.backed.fi/logos/tokens/TSLAx.png",
    },
    {
        name: "NVIDIA xStock",
        address: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
        symbol: "NVDAX",
        decimals: 8,
        logo: "https://xstocks-metadata.backed.fi/logos/tokens/NVDAx.png",
    },
    {
        name: "SP500 xStock",
        address: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W",
        symbol: "SP500X",
        decimals: 8,
        logo: "https://xstocks-metadata.backed.fi/logos/tokens/SPYx.png",
    },
];
