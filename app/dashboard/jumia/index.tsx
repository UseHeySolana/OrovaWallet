import { useEffect } from "react";
import { router } from "expo-router";

/**
 * Jumia is used via AI tools (search-jumia-products, place-jumia-order).
 * Redirect to dashboard if user lands here.
 */
export default function JumiaRedirect() {
  useEffect(() => {
    router.replace("/dashboard");
  }, []);
  return null;
}
