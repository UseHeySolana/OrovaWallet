import { ImageSource } from "expo-image";
import { airBills } from "@/libs/tools/airbills/airbills";
import { magicblock } from "@/libs/tools/magicblock/magicblock";

export interface App {
  name: string;
  category: string;
  banner: string | ImageSource;
  icon: string | ImageSource;
  description: string;
  tutorial?: string;
  url: string;
  tags: string[];
  descriptionImages: string[];
  is_active: boolean;
  is_featured: boolean;
  is_new: boolean;
  ratings: number;
  short_des: string;
  brand_colors?: {
    primary: string;
    secondary: string;
  };
  tools?: {
    name: string;
    params: any[];
    action?: {
      type: string;
      url?: (...args: any[]) => any;
      params: any[];
    };
  }[];
}

const apps: App[] = [
  {
    name: "Crossmint",
    category: "Tools",
    short_des: "Agentic commerce at your tips.",
    icon: require("@/assets/apps/crossmint/logo.png"),
    description:
      "Shop from a wide range of products on the solana blockchain with ease, you can use your usdc to pay for items on Amazon and Shopify.",
    banner: require("@/assets/apps/crossmint/banner.png"),
    url: "https://www.crossmint.com/",
    tags: ["Commerce", "Stablecoin", "Solana", "Agentic"],
    descriptionImages: [
      // require('@/assets/apps/crossmint/badge/mint.webp'),
      // require('@/assets/apps/crossmint/badge/onramp.png'),
      // require('@/assets/apps/crossmint/badge/paid.png'),
    ],
    brand_colors: {
      primary: "#00C768",
      secondary: "#0A1825",
    },
    is_active: true,
    is_featured: false,
    is_new: true,
    ratings: 4.5,
    tools: [
      {
        name: "Agentic Commerce",
        params: [
          {
            name: "name",
            type: "string",
          },
          {
            name: "line1",
            type: "string",
          },
          {
            name: "city",
            type: "string",
          },
          {
            name: "state",
            type: "string",
          },
          {
            name: "postalCode",
            type: "string",
          },
          {
            name: "country",
            type: "string",
          },
        ],
      },
      {
        name: "tracking email",
        params: [
          {
            name: "email",
            type: "string",
          },
        ],
      },
    ],
  },
  {
    name: "Airbills",
    category: "Tools",
    short_des: "Instant bills payment!",
    banner: require("@/assets/apps/airbillsbg.jpeg"),
    icon: require("@/assets/apps/airbillslogo.jpg"),
    description:
      "Airbills is a platform that allows you to get utility such as airtime and electricity bill with solana tokens.",

    url: "https://airbills.com",
    tags: ["Tools"],
    descriptionImages: [
      // "https://airbills.com/images/1.png",
      // "https://airbills.com/images/2.png",
      // "https://airbills.com/images/3.png",
      // "https://airbills.com/images/4.png",
    ],
    is_active: true,
    is_featured: true,
    is_new: true,
    ratings: 4.5,
    tools: [
      {
        name: "electricity",
        params: [
          {
            name: "meter_number",
            type: "string",
          },
          {
            name: "elect_id",
            type: "select",
            options: [
              {
                value: "01",
                name: "Eko Electric - EKEDC (PHCN)",
              },
              {
                value: "02",
                name: "Ikeja Electric - IKEDC (PHCN)",
              },
              {
                value: "03",
                name: "Abuja Electric - AEDC",
              },
              {
                value: "04",
                name: "Kano Electric - KEDC",
              },
              {
                value: "05",
                name: "Portharcourt Electric - PHEDC",
              },
              {
                value: "06",
                name: "Jos Electric - JEDC",
              },
              {
                value: "07",
                name: "Ibadan Electric - IBEDC",
              },
              {
                value: "08",
                name: "Kaduna Electric - KAEDC",
              },
              {
                value: "09",
                name: "ENUGU Electric - EEDC",
              },
              {
                value: "10",
                name: "BENIN Electric - BEDC",
              },
              {
                value: "11",
                name: "YOLA Electric - YEDC",
              },
              {
                value: "12",
                name: "ABA Electric - APLE",
              },
            ],
          },
          {
            name: "meter_type",
            type: "select",
            options: [
              {
                name: "Prepaid",
                value: "01",
              },
              {
                name: "Postpaid",
                value: "02",
              },
            ],
          },
        ],
        action: {
          type: "Verify",
          url: airBills.electricity.verifyMeter,
          params: [
            {
              name: "meter_number",
              type: "string",
            },
            {
              name: "elect_id",
              type: "string",
            },
            {
              name: "meter_type",
              type: "string",
            },
          ],
        },
      },
    ],
  },
  {
    name: "Pajcash",
    category: "Finance",
    short_des: "Onramp and offramp Solana tokens with Naira.",
    banner: require("@/assets/apps/pajbg.jpeg"),
    icon: require("@/assets/apps/pajcas.jpg"),
    description:
      "Pajcash lets you buy crypto with Naira (onramp) or sell tokens for Naira (offramp) without leaving HeySolana.",
    tutorial:
      "Add your email or phone, verify with PajCash OTP, then add bank details for offramp. You can onramp or offramp any supported SPL token.",
    url: "https://paj.cash",
    tags: ["Finance", "Onramping", "Offramping", "Solana", "SPL"],
    descriptionImages: [
      // "https://paj.cash/images/1.png",
      // "https://paj.cash/images/2.png",
      // "https://paj.cash/images/3.png",
      // "https://paj.cash/images/4.png",
    ],
    is_active: true,
    is_featured: true,
    is_new: true,
    ratings: 4.5,
    tools: [
      {
        name: "credentials",
        params: [
          {
            name: "email_or_phone",
            type: "string",
            label: "Email or phone",
            helper: "Use the email or phone number that should receive the PajCash OTP.",
          },
        ],
      },
      {
        name: "offramp",
        params: [
          {
            name: "account_number",
            type: "string",
            label: "Bank account number",
          },
          {
            name: "bank",
            type: "string",
            label: "Bank name or code",
          },
          {
            name: "bank_id",
            type: "string",
            label: "Bank ID",
            helper: "Optional. Use this only if PajCash gives you a bank ID.",
            optional: true,
          },
          {
            name: "account_name",
            type: "string",
            label: "Account name",
            optional: true,
          },
        ],
      },
    ],
  },
  {
    name: "Jupiter",
    category: "Finance",
    short_des: "Swap with low fees.",
    banner: require("@/assets/apps/jup/jup1.webp"),
    icon: require("@/assets/apps/jup.png"),

    description:
      "Jupiter allows you to swap and make with low fees on the solana blockchain, ensure you check the prices before performing any transactions.",

    url: "https://jup.ag",
    tags: ["Finance"],
    descriptionImages: [
      require("@/assets/apps/jup/jup1.webp"),
      require("@/assets/apps/jup/jup2.webp"),
      require("@/assets/apps/jup/jup3.webp"),
    ],
    is_active: true,
    is_featured: true,
    is_new: true,
    ratings: 4.5,
  },
  {
    name: "HeySolana",
    category: "Defi",
    short_des: "Your smart, multilingual AI voice assistant.",
    icon: "https://play-lh.googleusercontent.com/Ji7R_hjJVE22s_pcXRjYynyQPjrNAuPBZ8L8jyoiTqtoajpf0ePmx2igJO4utf1zf3PA=w480-h960-rw",
    description: `HeySolana is your smart, multilingual AI voice assistant—powered by OpenAI and built for speed.
Talk, ask, command, and get things done with just your voice. From managing your daily tasks to fetching on-chain data, HeySolana does it all in real-time.`,
    banner:
      "https://play-lh.googleusercontent.com/ovVoZi6Vd3_1NeT3xVx-tJqRPdj8VYWte5e27ckpYRLqFuvZLTEuZ19sEK0egBIIyl0=w1052-h592-rw",
    url: "https://heysolana.yraylabs.fun",
    tags: ["Defi", "Swap", "NFT", "Solana"],
    is_active: true,
    descriptionImages: [
      "https://play-lh.googleusercontent.com/r8JLboWPNAINw25fO5kQZ4tVQstyh7z7Jp-mGR6oMIG9dOTbUCy7JaAv7l2PxkW90w=w1052-h592-rw",
      "https://play-lh.googleusercontent.com/ovVoZi6Vd3_1NeT3xVx-tJqRPdj8VYWte5e27ckpYRLqFuvZLTEuZ19sEK0egBIIyl0=w1052-h592-rw",
      "https://play-lh.googleusercontent.com/Zm9t7svVzpceOvujOeyLyJ1RI37H8gfGIO-Xbe39p7ByMI24_zurU-F3HS8UcTahww=w1052-h592-rw",
      "https://play-lh.googleusercontent.com/tFGMKIJTDfKGJ2c6NedALGajl5Y3hgNf83TptIKFYEuVCzvVkYjuoN7ijfrIX9OYNQ=w1052-h592-rw",
    ],
    is_featured: false,
    is_new: true,
    ratings: 4.5,
  },
  // {
  //   name: "NexuMint",
  //   category: "Tools",
  //   short_des: "Easy token management and creation on Solana.",
  //   icon: require("@/assets/apps/wavelet/logo.png"),
  //   description:
  //     "Easy token management and creation on Solana | Create, mint, burn, update authorities, airdrop, rug check tokens.",
  //   banner: require("@/assets/apps/nexumint/banner.jpeg"),
  //   url: "https://nexumint.xyz",
  //   tags: ["Finance", "Stablecoin", "Offramping", "NFT's", "Solana"],
  //   descriptionImages: [
  //     require("@/assets/apps/nexumint/des1.jpeg"),
  //     require("@/assets/apps/nexumint/des2.jpeg"),
  //   ],
  //   is_active: false,
  //   is_featured: false,
  //   is_new: false,
  //   ratings: 0,
  //   tools: [],
  // },
  // {
  //   name: "Wavelet",
  //   category: "Finance",
  //   short_des: "Spend your crypto without offramping.",
  //   icon: require("@/assets/apps/wavelet/logo.png"),
  //   description:
  //     "Wavelet is a platform that allows you to spend your crypto without offramping, just send your money to any bank account in Nigeria or Ghana",
  //   banner: "",
  //   url: "https://wavelet.yraylabs.fun",
  //   tags: [
  //     "Finance",
  //     "Stablecoin",
  //     "Offramping",
  //     "Rates",
  //     "Naira",
  //     "Ghana Cedis",
  //     "Ecommerce",
  //   ],
  //   descriptionImages: [
  //     // "https://wavelet.yraylabs.fun/images/1.png",
  //     // "https://wavelet.yraylabs.fun/images/2.png",
  //     // "https://wavelet.yraylabs.fun/images/3.png",
  //     // "https://wavelet.yraylabs.fun/images/4.png",
  //   ],
  //   is_active: false,
  //   is_featured: false,
  //   is_new: false,
  //   ratings: 4.5,
  //   tools: [
  //     {
  //       name: "spend",
  //       params: [
  //         {
  //           name: "account_number",
  //           type: "string",
  //         },
  //       ],
  //     },
  //   ],
  // },
  // {
  //   name: "Bayse Prediction Markets",
  //   category: "Finance",
  //   short_des: "Trade prediction markets with NGN/USD support.",
  //   icon: "https://docs.bayse.markets/logo/light.svg",
  //   description:
  //     "Bayse lets you trade event outcomes across sports, politics, crypto, and more. Use API keys to activate secure server-side signed trading from HeySolana.",
  //   banner: require("@/assets/apps/bayse/banner.png"),
  //   url: "https://link.bayse.markets/app",
  //   tags: ["Prediction", "Markets", "Trading", "Finance", "NGN"],
  //   descriptionImages: [],
  //   is_active: true,
  //   is_featured: true,
  //   is_new: true,
  //   ratings: 4.6,
  //   tools: [
  //     {
  //       name: "credentials",
  //       params: [
  //         {
  //           name: "public_key",
  //           type: "string",
  //           label: "Bayse Public Key",
  //           placeholder: "pk_live_...",
  //           helper: "Public API key used in request headers.",
  //         },
  //         {
  //           name: "secret_key",
  //           type: "string",
  //           label: "Bayse Secret Key",
  //           placeholder: "sk_live_...",
  //           helper: "Keep this secret. It is used to generate HMAC signatures for write requests.",
  //           secure: true,
  //         },
  //         {
  //           name: "key_label",
  //           type: "string",
  //           label: "Key nickname (optional)",
  //           placeholder: "e.g. HeySolana Wallet",
  //           helper: "Optional label to help identify this key pair.",
  //         },
  //         {
  //           name: "default_currency",
  //           type: "select",
  //           options: [
  //             { value: "NGN", name: "NGN (Nigeria Naira)" },
  //             { value: "USD", name: "USD (US Dollar)" },
  //           ],
  //         },
  //       ],
  //     },
  //     {
  //       name: "prediction_preferences",
  //       params: [
  //         { name: "max_order_size", type: "string" },
  //         { name: "default_side", type: "select", options: [{ value: "BUY", name: "Buy" }, { value: "SELL", name: "Sell" }] },
  //       ],
  //     },
  //   ],
  // },
  {
    name: "Kalshi Prediction Markets",
    category: "Finance",
    short_des: "Trade real-world event markets with secure backend signing.",
    icon: require("@/assets/apps/kalshi/logo.png"),
    description:
      "Activate Kalshi prediction markets and securely back up your API credentials. HeySolana generates your signing key on the backend and stores it encrypted for transaction signing.",
    banner: require("@/assets/apps/kalshi/banner.png"),
    url: "https://kalshi.com",
    tags: ["Prediction", "Markets", "Trading", "Finance"],
    descriptionImages: [],
    is_active: true,
    is_featured: true,
    is_new: true,
    ratings: 4.6,
    tools: [
      {
        name: "credentials",
        params: [
          {
            name: "kalshi_access_key_id",
            type: "string",
            label: "Kalshi Key ID",
            placeholder: "Paste your Kalshi Key ID",
            helper: "This is the Key ID shown when you create an API key on Kalshi.",
          },
          {
            name: "private_key",
            type: "string",
            label: "Kalshi Private Key",
            placeholder: "Paste the full PRIVATE KEY block (BEGIN/END included)",
            helper:
              "This is secret. Paste the entire key including the BEGIN/END lines. You can only view it once on Kalshi.",
            multiline: true,
            secure: true,
          },
          {
            name: "key_label",
            type: "string",
            label: "Key nickname (optional)",
            placeholder: "e.g. HeySolana iPhone",
            helper: "Just a label for you. Does not affect trading.",
          },
          { name: "environment", type: "select", options: [{ value: "production", name: "Production" }, { value: "staging", name: "Staging" }] },
        ],
      },
      {
        name: "prediction_preferences",
        params: [
          { name: "max_order_size", type: "string" },
          { name: "default_order_type", type: "select", options: [{ value: "market", name: "Market" }, { value: "limit", name: "Limit" }] },
          { name: "default_side", type: "select", options: [{ value: "yes", name: "Yes" }, { value: "no", name: "No" }] },
          { name: "risk_mode", type: "select", options: [{ value: "conservative", name: "Conservative" }, { value: "balanced", name: "Balanced" }, { value: "aggressive", name: "Aggressive" }] },
        ],
      },
    ],
  },
  {
    name: "MagicBlock Private Payments",
    category: "Finance",
    short_des: "Confidential SPL transfers via ephemeral rollup.",
    icon: require("@/assets/apps/magicblock/logo.png"),
    description:
      "Send SPL tokens privately on Solana. Powered by MagicBlock's ephemeral rollup, transfers can be delayed, split into multiple settlements, and shielded from on-chain observers.",
    banner: require("@/assets/apps/magicblock/banner.png"),
    url: "https://payments.magicblock.app",
    tags: ["Privacy", "Solana", "Stablecoin", "Rollup"],
    descriptionImages: [],
    brand_colors: {
      primary: "#7B5CFF",
      secondary: "#0A1825",
    },
    is_active: true,
    is_featured: true,
    is_new: true,
    ratings: 4.7,
    tools: [
      {
        name: "preferences",
        params: [
          {
            name: "default_visibility",
            type: "select",
            label: "Default privacy mode",
            options: [
              { value: "private", name: "Private (delayed + split)" },
              { value: "public", name: "Public (transparent)" },
            ],
          },
          {
            name: "default_split",
            type: "select",
            label: "Default split count",
            options: [
              { value: "1", name: "No split (1)" },
              { value: "3", name: "3 chunks" },
              { value: "5", name: "5 chunks" },
              { value: "10", name: "10 chunks" },
            ],
            helper:
              "How many queue entries to spread a private transfer across.",
          },
          {
            name: "default_min_delay_ms",
            type: "string",
            label: "Min delay (ms)",
            placeholder: "0",
            helper: "Earliest a queued private transfer may settle.",
          },
          {
            name: "default_max_delay_ms",
            type: "string",
            label: "Max delay (ms)",
            placeholder: "60000",
            helper:
              "Latest a queued private transfer may settle. Max 600000 (10m).",
          },
          {
            name: "default_mint",
            type: "select",
            label: "Default token",
            options: [
              { value: "USDC", name: "USDC" },
              { value: "USDT", name: "USDT" },
            ],
          },
          {
            name: "gasless",
            type: "select",
            label: "Gasless (sponsor fees)",
            options: [
              { value: "on", name: "On — sponsor pays SOL fees" },
              { value: "off", name: "Off — I pay my own SOL fees" },
            ],
            helper:
              "When on, MagicBlock's relay sponsor pays the SOL fee and a small relay fee in the transferred token is added.",
          },
        ],
        action: {
          type: "Test connection",
          url: magicblock.health,
          params: [],
        },
      },
    ],
  },
  {
    name: "Jumia Online Shopping",
    category: "Ecommerce",
    short_des: "Get ready for big deals, with Jumia 🛒, you always win!",
    icon: require("@/assets/apps/jumia/jumia.webp"),
    description:
      "Jumia is a platform that allows you to shop online for products in Nigeria and Ghana. Use the AI assistant to search for products and place orders.",
    banner: require("@/assets/apps/jumia/banner.webp"),
    url: "https://jumia.com",
    tags: ["Stablecoin", "Ecommerce", "Shopping"],
    descriptionImages: [
      require("@/assets/apps/jumia/img1.webp"),
      require("@/assets/apps/jumia/img2.webp"),
      require("@/assets/apps/jumia/img3.webp"),
      require("@/assets/apps/jumia/img4.webp"),
    ],
    is_active: true,
    is_featured: true,
    is_new: true,
    ratings: 4.5,
    tools: [
      {
        name: "ecommerce",
        params: [
          { name: "Address Name", type: "string" },
          { name: "email", type: "string" },
          { name: "address_line_1", type: "string" },
          { name: "city", type: "string" },
          { name: "state", type: "string" },
          { name: "postal_code", type: "string" },
          { name: "country", type: "string" },
        ],
      },
    ],
  },
];

const categories = [
  {
    name: "Defi",
    icon: require("@/assets/apps/devtools.png"),
  },
  {
    name: "Finance",
    icon: require("@/assets/apps/financial.png"),
  },
  {
    name: "Tools",
    icon: require("@/assets/apps/sports.png"),
  },
  {
    name: "Social",
    icon: require("@/assets/apps/sports.png"),
  },
];

const reviews = [
  {
    app_name: "Airbills",
    rating: 4.5,
    review:
      "Airbills is a great app for sending and receiving money. It's easy to use and has a great interface.",
    user_name: "John Doe",
    user_image: "https://via.placeholder.com/150",
    user_id: "1234567890",
    created_at: "2021-01-01",
  },
  {
    app_name: "Pajcash",
    rating: 4.5,
    review:
      "Pajcash is a great app for sending and receiving money. It's easy to use and has a great interface.",
    user_name: "John Doe",
    user_image: "https://via.placeholder.com/150",
    user_id: "1234567890",
    created_at: "2021-01-01",
  },
  {
    app_name: "Jupiter",
    rating: 4.5,
    review: "Jupiter allows you to swap and make with low fees. ",
    user_name: "John Doe",
    user_image: "https://via.placeholder.com/150",
    user_id: "1234567890",
    created_at: "2021-01-01",
  },
  {
    app_name: "Jupiter",
    rating: 3.5,
    review: "Jupiter allows you to swap and make with low fees. ",
    user_name: "John Doe",
    user_image: "https://via.placeholder.com/150",
    user_id: "1234567890",
    created_at: "2021-01-01",
  },
  {
    app_name: "HeySolana",
    rating: 4.5,
    review:
      "HeySolana is a great app for sending and receiving money. It's easy to use and has a great interface.",
    user_name: "John Doe",
    user_image: "https://via.placeholder.com/150",
    user_id: "1234567890",
    created_at: "2021-01-01",
  },
  {},
];

export { apps, categories, reviews };
