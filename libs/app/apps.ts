import { ImageSource } from "expo-image";
import { airBills } from "@/libs/tools/airbills/airbills";

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
          ],
        },
      },
    ],
  },
  {
    name: "Pajcash",
    category: "Finance",
    short_des: "Offramp your solana tokens to naira.",
    banner: require("@/assets/apps/pajbg.jpeg"),
    icon: require("@/assets/apps/pajcas.jpg"),
    description:
      "Pajcash is a platform that allows you to offramp your solana tokens to naira.",
    tutorial:
      "To use this tool, you need to connect your solana wallet on paj.cash, and then fill the details here!.",
    url: "https://paj.cash",
    tags: ["Finance", "Offramping", "Solana", "USDC"],
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
        name: "offramp",
        params: [
          {
            name: "account_number",
            type: "string",
          },
          {
            name: "bank",
            type: "string",
          },
          {
            name: "account_name",
            type: "string",
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
  {
    name: "NexuMint",
    category: "Tools",
    short_des: "Easy token management and creation on Solana.",
    icon: require("@/assets/apps/wavelet/logo.png"),
    description:
      "Easy token management and creation on Solana | Create, mint, burn, update authorities, airdrop, rug check tokens.",
    banner: require("@/assets/apps/nexumint/banner.jpeg"),
    url: "https://nexumint.xyz",
    tags: ["Finance", "Stablecoin", "Offramping", "NFT's", "Solana"],
    descriptionImages: [
      require("@/assets/apps/nexumint/des1.jpeg"),
      require("@/assets/apps/nexumint/des2.jpeg"),
    ],
    is_active: false,
    is_featured: false,
    is_new: false,
    ratings: 0,
    tools: [],
  },
  {
    name: "Wavelet",
    category: "Finance",
    short_des: "Spend your crypto without offramping.",
    icon: require("@/assets/apps/wavelet/logo.png"),
    description:
      "Wavelet is a platform that allows you to spend your crypto without offramping, just send your money to any bank account in Nigeria or Ghana",
    banner: "",
    url: "https://wavelet.yraylabs.fun",
    tags: [
      "Finance",
      "Stablecoin",
      "Offramping",
      "Rates",
      "Naira",
      "Ghana Cedis",
      "Ecommerce",
    ],
    descriptionImages: [
      // "https://wavelet.yraylabs.fun/images/1.png",
      // "https://wavelet.yraylabs.fun/images/2.png",
      // "https://wavelet.yraylabs.fun/images/3.png",
      // "https://wavelet.yraylabs.fun/images/4.png",
    ],
    is_active: false,
    is_featured: false,
    is_new: false,
    ratings: 4.5,
    tools: [
      {
        name: "spend",
        params: [
          {
            name: "account_number",
            type: "string",
          },
        ],
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
