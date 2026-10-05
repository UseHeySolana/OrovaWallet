import type { ConfigContext, ExpoConfig } from "expo/config";

export type AppVariant = "play" | "solana-mobile";

const PLAY_EAS_PROJECT_ID = "44e617dc-89eb-42b2-bcfc-79a78f074bd3";
const SOLANA_MOBILE_EAS_PROJECT_ID = "aee792b8-12be-42be-aa93-d1dfa3b3d32d";

function getAppVariant(): AppVariant {
  return process.env.APP_VARIANT === "solana-mobile" ? "solana-mobile" : "play";
}

function googleIosUrlSchemeFromEnv(): string | null {
  const iosClientId =
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || "";
  const match = iosClientId.match(/^([\w-]+)\.apps\.googleusercontent\.com$/);
  return match ? `com.googleusercontent.apps.${match[1]}` : null;
}

const variantIdentity: Record<
  AppVariant,
  Pick<ExpoConfig, "name" | "slug"> & {
    ios: { bundleIdentifier: string };
    android: { package: string };
    easProjectId: string;
  }
> = {
  play: {
    name: "Orova",
    slug: "heysolana",
    ios: { bundleIdentifier: "com.maskyray.heysolana" },
    android: { package: "com.maskyray.heysolana" },
    easProjectId: PLAY_EAS_PROJECT_ID,
  },
  "solana-mobile": {
    name: "Orova: AI Wallet",
    slug: "heysolana-solana-mobile",
    ios: { bundleIdentifier: "com.yraylabs.heysolana" },
    android: { package: "com.yraylabs.heysolana" },
    easProjectId: SOLANA_MOBILE_EAS_PROJECT_ID,
  },
};

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = getAppVariant();
  const identity = variantIdentity[variant];
  const iosUrlScheme = googleIosUrlSchemeFromEnv();

  const android = {
    ...config.android,
    package: identity.android.package,
  };

  android.googleServicesFile =
    config.android?.googleServicesFile ?? "./google-services.json";

  const plugins = (config.plugins ?? []).map((plugin) => {
    if (plugin === "@react-native-google-signin/google-signin" && iosUrlScheme) {
      return [
        "@react-native-google-signin/google-signin",
        { iosUrlScheme },
      ] as [string, { iosUrlScheme: string }];
    }
    return plugin;
  });

  const ios = {
    ...config.ios,
    bundleIdentifier: identity.ios.bundleIdentifier,
    googleServicesFile:
      config.ios?.googleServicesFile ?? "./GoogleService-Info.plist",
  };

  return {
    ...config,
    name: identity.name,
    slug: identity.slug,
    ios,
    android,
    plugins,
    extra: {
      ...config.extra,
      appVariant: variant,
      eas: {
        ...config.extra?.eas,
        projectId: identity.easProjectId,
      },
    },
    updates: {
      ...config.updates,
      url: `https://u.expo.dev/${identity.easProjectId}`,
    },
  };
};
