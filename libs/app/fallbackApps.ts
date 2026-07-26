import type { App } from "./types";

/**
 * Bundled offline fallback catalog. Local assets live here / in capabilities.
 * Remote admin catalog overrides serializable fields when available.
 */
export const FALLBACK_APPS: App[] = [
  {
    slug: "crossmint",
    name: "Crossmint",
    category: "Tools",
    short_des: "Agentic commerce at your tips.",
    icon: require("@/assets/apps/crossmint/logo.png"),
    description:
      "Shop from a wide range of products on the solana blockchain with ease, you can use your usdc to pay for items on Amazon and Shopify.",
    banner: require("@/assets/apps/crossmint/banner.png"),
    url: "https://www.crossmint.com/",
    tags: ["Commerce", "Stablecoin", "Solana", "Agentic"],
    descriptionImages: [],
    brand_colors: {
      primary: "#00C768",
      secondary: "#0A1825",
    },
    is_active: true,
    is_featured: false,
    is_new: true,
    ratings: 4.5,
    sort_order: 10,
    capability_ids: ["crossmint"],
    tools: [
      {
        name: "Agentic Commerce",
        params: [
          { name: "name", type: "string" },
          { name: "line1", type: "string" },
          { name: "city", type: "string" },
          { name: "state", type: "string" },
          { name: "postalCode", type: "string" },
          { name: "country", type: "string" },
        ],
      },
      {
        name: "tracking email",
        params: [{ name: "email", type: "string" }],
      },
    ],
  },
  {
    slug: "airbills",
    name: "Airbills",
    category: "Tools",
    short_des: "Instant bills payment!",
    banner: require("@/assets/apps/airbillsbg.jpeg"),
    icon: require("@/assets/apps/airbillslogo.jpg"),
    description:
      "Airbills lets you buy airtime, mobile data bundles, and electricity bills with USDC on Solana.",
    dashboardRoute: "/dashboard/airbills",
    url: "https://airbills.com",
    tags: ["Tools"],
    descriptionImages: [],
    is_active: true,
    is_featured: true,
    is_new: true,
    ratings: 4.5,
    sort_order: 20,
    capability_ids: ["airbills"],
    tools: [
      {
        name: "airtime",
        params: [
          {
            name: "phone_number",
            type: "string",
            label: "Phone number",
            placeholder: "08012345678",
            helper: "The mobile number that will receive the airtime.",
          },
          {
            name: "network_id",
            type: "select",
            optional: true,
            options: [
              { value: "01", name: "MTN" },
              { value: "02", name: "Glo" },
              { value: "03", name: "9mobile" },
              { value: "04", name: "Airtel" },
            ],
          },
        ],
        action: {
          type: "Top Up",
          route: "/dashboard/airbills/airtime",
          params: [
            { name: "phone_number", type: "string" },
            { name: "network_id", type: "string" },
          ],
        },
      },
      {
        name: "internet",
        params: [
          {
            name: "phone_number",
            type: "string",
            label: "Phone number",
            placeholder: "08012345678",
            helper: "The mobile number that will receive the data bundle.",
          },
          {
            name: "network_id",
            type: "select",
            optional: true,
            options: [
              { value: "01", name: "MTN" },
              { value: "02", name: "Glo" },
              { value: "03", name: "9mobile" },
              { value: "04", name: "Airtel" },
            ],
          },
        ],
        action: {
          type: "Browse Plans",
          route: "/dashboard/airbills/data",
          params: [
            { name: "phone_number", type: "string" },
            { name: "network_id", type: "string" },
          ],
        },
      },
      {
        name: "electricity",
        params: [
          { name: "meter_number", type: "string" },
          {
            name: "elect_id",
            type: "select",
            options: [
              { value: "01", name: "Eko Electric - EKEDC (PHCN)" },
              { value: "02", name: "Ikeja Electric - IKEDC (PHCN)" },
              { value: "03", name: "Abuja Electric - AEDC" },
              { value: "04", name: "Kano Electric - KEDC" },
              { value: "05", name: "Portharcourt Electric - PHEDC" },
              { value: "06", name: "Jos Electric - JEDC" },
              { value: "07", name: "Ibadan Electric - IBEDC" },
              { value: "08", name: "Kaduna Electric - KAEDC" },
              { value: "09", name: "ENUGU Electric - EEDC" },
              { value: "10", name: "BENIN Electric - BEDC" },
              { value: "11", name: "YOLA Electric - YEDC" },
              { value: "12", name: "ABA Electric - APLE" },
            ],
          },
          {
            name: "meter_type",
            type: "select",
            options: [
              { name: "Prepaid", value: "01" },
              { name: "Postpaid", value: "02" },
            ],
          },
        ],
        action: {
          type: "Verify",
          action_id: "airbills.verify_meter",
          params: [
            { name: "meter_number", type: "string" },
            { name: "elect_id", type: "string" },
            { name: "meter_type", type: "string" },
          ],
        },
      },
    ],
  },
  {
    slug: "pajcash",
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
    descriptionImages: [],
    is_active: true,
    is_featured: true,
    is_new: true,
    ratings: 4.5,
    sort_order: 30,
    capability_ids: ["pajcash"],
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
          { name: "account_number", type: "string", label: "Bank account number" },
          { name: "bank", type: "string", label: "Bank name or code" },
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
    slug: "jupiter",
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
    sort_order: 40,
    capability_ids: ["jupiter"],
  },
  {
    slug: "heysolana",
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
    sort_order: 50,
    capability_ids: ["heysolana"],
  },
  {
    slug: "chowdeck",
    name: "Chowdeck",
    category: "Ecommerce",
    short_des: "Order food nearby. Pay with USDC (or SOL on request).",
    icon: require("@/assets/apps/chowdeck/icon.png"),
    description:
      "Chowdeck lets you discover restaurants near your delivery location, build a cart with menu modifiers, and pay with USDC by default (or SOL if you ask). Activate this app, save your delivery address once, then ask Orova for food — you'll only be asked again if you want to change it.",
    banner: require("@/assets/apps/chowdeck/banner.png"),
    url: "https://chowdeck.com",
    tags: ["Stablecoin", "Food", "Delivery"],
    descriptionImages: [
      require("@/assets/apps/chowdeck/banner.png"),
    ],
    is_active: true,
    is_featured: true,
    is_new: true,
    ratings: 4.6,
    sort_order: 60,
    visibility: "beta",
    capability_ids: ["chowdeck"],
    tools: [
      {
        name: "food_delivery",
        params: [
          {
            name: "delivery_address",
            type: "chowdeck_address",
            label: "Delivery address",
            placeholder: "Street + area (e.g. 12 Ademola Cres, Mpape)",
            helper:
              "Include a street or landmark — short area names often return one generic match.",
          },
        ],
      },
    ],
  },
];

export const categories = [
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

export const reviews = [
  {
    app_name: "Airbills",
    app_slug: "airbills",
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
    app_slug: "pajcash",
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
    app_slug: "jupiter",
    rating: 4.5,
    review: "Jupiter allows you to swap and make with low fees. ",
    user_name: "John Doe",
    user_image: "https://via.placeholder.com/150",
    user_id: "1234567890",
    created_at: "2021-01-01",
  },
  {
    app_name: "Jupiter",
    app_slug: "jupiter",
    rating: 3.5,
    review: "Jupiter allows you to swap and make with low fees. ",
    user_name: "John Doe",
    user_image: "https://via.placeholder.com/150",
    user_id: "1234567890",
    created_at: "2021-01-01",
  },
  {
    app_name: "HeySolana",
    app_slug: "heysolana",
    rating: 4.5,
    review:
      "HeySolana is a great app for sending and receiving money. It's easy to use and has a great interface.",
    user_name: "John Doe",
    user_image: "https://via.placeholder.com/150",
    user_id: "1234567890",
    created_at: "2021-01-01",
  },
];
