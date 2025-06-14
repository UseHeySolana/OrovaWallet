import IconLibrary from "@/misc/helpers/icons";

const apps = [
    {
        name: "Airbills",
        category: "Tools",
        banner: require('@/assets/apps/airbillsbg.jpeg'),
        icon: require('@/assets/apps/airbillslogo.jpg'),
        description: "Airbills is a platform that allows you to get utility such as airtime and electricity bill with solana tokens.",
        url: "https://airbills.com",
        tags: ["Tools"],
        descriptionImages: [
            "https://airbills.com/images/1.png",
            "https://airbills.com/images/2.png",
            "https://airbills.com/images/3.png",
            "https://airbills.com/images/4.png",
        ],
        is_active: true,
        is_featured: true,
        is_new: true,
        ratings: 4.5,
    },
    {
        name: "Pajcash",
        category: "Finance",
        banner: require('@/assets/apps/pajbg.jpeg'),
        icon: require('@/assets/apps/pajcas.jpg'),
        description: "Pajcash is a platform that allows you to offramp your solana tokens to naira.",
        url: "https://paj.cash",
        tags: ["Finance", "Offramping", "Solana", "USDC"],
        descriptionImages: [
            "https://paj.cash/images/1.png",
            "https://paj.cash/images/2.png",
            "https://paj.cash/images/3.png",
            "https://paj.cash/images/4.png",
        ],
        is_active: true,
        is_featured: true,
        is_new: true,
        ratings: 4.5,
    },
    {
        name: "Jupiter",
        category: "Finance",
        banner: require('@/assets/apps/jup/jup1.webp'),
        icon: require('@/assets/apps/jup.png'),

        description: "Jupiter allows you to swap and make with low fees on the solana blockchain, ensure you check the prices before performing any transactions.",

        url: "https://jup.ag",
        tags: ["Finance"],
        descriptionImages: [
            require('@/assets/apps/jup/jup1.webp'),
            require('@/assets/apps/jup/jup2.webp'),
            require('@/assets/apps/jup/jup3.webp'),
        ],
        is_active: true,
        is_featured: true,
        is_new: true,
        ratings: 4.5,
    },
    {
        name: "HeySolana",
        category: "Defi",
        icon: "https://play-lh.googleusercontent.com/Ji7R_hjJVE22s_pcXRjYynyQPjrNAuPBZ8L8jyoiTqtoajpf0ePmx2igJO4utf1zf3PA=w480-h960-rw",
        description: `HeySolana is your smart, multilingual AI voice assistant—powered by OpenAI and built for speed.
Talk, ask, command, and get things done with just your voice. From managing your daily tasks to fetching on-chain data, HeySolana does it all in real-time.`,
        banner: "https://play-lh.googleusercontent.com/ovVoZi6Vd3_1NeT3xVx-tJqRPdj8VYWte5e27ckpYRLqFuvZLTEuZ19sEK0egBIIyl0=w1052-h592-rw",
        url: "https://heysolana.yraylabs.fun",
        tags: ["Defi", "Swap", "NFT", "Solana"],
        is_active: true,
        descriptionImages: [
            "https://heysolana.yraylabs.fun/images/1.png",
            "https://heysolana.yraylabs.fun/images/2.png",
            "https://heysolana.yraylabs.fun/images/3.png",
            "https://heysolana.yraylabs.fun/images/4.png",
        ],
        is_featured: false,
        is_new: true,
        ratings: 4.5,
    },
    {
        name: "Wavelet",
        category: "Finance",
        icon: "",
        description: "",
        banner: "",
        url: "https://wavelet.yraylabs.fun",
        tags: ["Finance", "Stablecoin", "Offramping"],
        descriptionImages: [
            "https://wavelet.yraylabs.fun/images/1.png",
            "https://wavelet.yraylabs.fun/images/2.png",
            "https://wavelet.yraylabs.fun/images/3.png",
            "https://wavelet.yraylabs.fun/images/4.png",
        ],
        is_active: false,
        is_featured: false,
        is_new: true,
        ratings: 0,
    }
]
const categories = [
    {
        name: "Defi",
        icon: require('@/assets/apps/devtools.png')
    },
    {
        name: "Finance",
        icon: require('@/assets/apps/financial.png')
    },
    {
        name: "Tools",
        icon: require('@/assets/apps/sports.png'),
    },
    {
        name: "Social",
        icon: require('@/assets/apps/sports.png'),
    }
]

const reviews = [
    {
        app_name: "Airbills",
        rating: 4.5,
        review: "Airbills is a great app for sending and receiving money. It's easy to use and has a great interface.",
        user_name: "John Doe",
        user_image: "https://via.placeholder.com/150",
        user_id: "1234567890",
        created_at: "2021-01-01",
    },
    {
        app_name: "Pajcash",
        rating: 4.5,
        review: "Pajcash is a great app for sending and receiving money. It's easy to use and has a great interface.",
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
    }, {
        app_name: "HeySolana",
        rating: 4.5,
        review: "HeySolana is a great app for sending and receiving money. It's easy to use and has a great interface.",
        user_name: "John Doe",
        user_image: "https://via.placeholder.com/150",
        user_id: "1234567890",
        created_at: "2021-01-01",
    }, {
    }
]

export {

    apps, categories, reviews
}