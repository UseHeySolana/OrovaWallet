import { useEffect } from "react";
import * as Linking from "expo-linking";
import { usePIP } from "./PIPManager";

export default function PIPDeepLinkHandler() {
  const { showPIP } = usePIP();

  useEffect(() => {
    const handleDeepLink = (event: { url: string } | string) => {
      const url = typeof event === "string" ? event : event.url;
      if (url && url.includes("pip/show")) {
        showPIP();
      }
    };
    const subscription = Linking.addEventListener("url", handleDeepLink);
    Linking.getInitialURL().then((url) => {
      if (url && url.includes("pip/show")) {
        showPIP();
      }
    });
    return () => subscription.remove();
  }, [showPIP]);

  return null;
} 