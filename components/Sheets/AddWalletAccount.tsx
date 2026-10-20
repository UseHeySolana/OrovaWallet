import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import DragableSheet from "../CustomItems/DragableSheet";
import { CText } from "../TextComp";
import AccountsStore from "@/utils/store/accounts.store";
import type {
  KycRequirement,
  UserWalletAccount,
  WalletTypeCatalogItem,
} from "@/utils/wallet/accountsApi";
import { fetchWalletTypeDetail } from "@/utils/wallet/accountsApi";
import { useThemeContext } from "@/context/ThemeContext";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Step = "pick" | "kyc" | "done";

export default function AddWalletAccount({ open, onClose }: Props) {
  const { isDarkMode } = useThemeContext();
  const { catalog, refreshCatalog, addAccount, submitKyc, accounts } =
    AccountsStore();
  const [step, setStep] = useState<Step>("pick");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<WalletTypeCatalogItem | null>(null);
  const [pendingWallet, setPendingWallet] = useState<UserWalletAccount | null>(
    null
  );
  const [kycFields, setKycFields] = useState<Record<string, string>>({});
  const [kycFiles, setKycFiles] = useState<
    Record<string, { uri: string; name: string; type: string }>
  >({});
  const [requirements, setRequirements] = useState<KycRequirement[]>([]);

  useEffect(() => {
    if (!open) return;
    setStep("pick");
    setError(null);
    setSelected(null);
    setPendingWallet(null);
    setKycFields({});
    setKycFiles({});
    refreshCatalog();
  }, [open]);

  if (!open) return null;

  const ownedSlugs = new Set(accounts.map((a) => a.type_slug).filter(Boolean));
  const options = catalog.filter(
    (t) =>
      t.slug !== "solana" &&
      (t.allows_multiple || !ownedSlugs.has(t.slug))
  );

  const startType = async (item: WalletTypeCatalogItem) => {
    setBusy(true);
    setError(null);
    setSelected(item);
    try {
      const detail = await fetchWalletTypeDetail(item.slug);
      const reqs = detail.kyc_requirements || [];
      const wallet = await addAccount(item.slug);
      setPendingWallet(wallet);

      if (
        reqs.length > 0 &&
        (wallet.status === "pending_kyc" || wallet.status === "rejected")
      ) {
        setRequirements(reqs);
        setStep("kyc");
      } else {
        setStep("done");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add account");
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async (slug: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setKycFiles((prev) => ({
      ...prev,
      [slug]: {
        uri: asset.uri,
        name: asset.fileName || `${slug}.jpg`,
        type: asset.mimeType || "image/jpeg",
      },
    }));
  };

  const submit = async () => {
    if (!pendingWallet) return;
    setBusy(true);
    setError(null);
    try {
      const wallet = await submitKyc(pendingWallet.id, kycFields, kycFiles);
      setPendingWallet(wallet);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "KYC submit failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DragableSheet
      snapPoints={["72%"]}
      close={onClose}
      child={
        <View className="flex-1 px-2">
          <CText
            style={{ fontFamily: "bold" }}
            className="text-[1.1rem] text-center mb-3"
          >
            {step === "pick"
              ? "Add account"
              : step === "kyc"
                ? `Verify for ${selected?.name || "wallet"}`
                : "Account ready"}
          </CText>

          {error ? (
            <CText className="text-red-500 text-center mb-2">{error}</CText>
          ) : null}

          {busy ? (
            <View className="py-10 items-center">
              <ActivityIndicator />
            </View>
          ) : null}

          {!busy && step === "pick" ? (
            <ScrollView className="flex-1">
              {options.length === 0 ? (
                <CText className="text-center text-gray-500 py-8">
                  No additional wallet types are active yet. Ask an admin to
                  activate NGN or Stellar in Wallet types.
                </CText>
              ) : (
                options.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => startType(item)}
                    className="mb-3 px-4 py-3 rounded-2xl bg-grey dark:bg-accent2"
                  >
                    <CText style={{ fontFamily: "bold" }} className="text-[1rem]">
                      {item.name}
                    </CText>
                    <CText className="text-gray-500 text-sm mt-1">
                      {item.description || item.category}
                    </CText>
                  </Pressable>
                ))
              )}
              <Pressable onPress={onClose} className="py-4">
                <CText className="text-center text-gray-500">Close</CText>
              </Pressable>
            </ScrollView>
          ) : null}

          {!busy && step === "kyc" ? (
            <ScrollView className="flex-1">
              {requirements.map((req) => {
                const isFile =
                  req.field_kind === "image" || req.field_kind === "document";
                return (
                  <View key={req.id} className="mb-4">
                    <CText style={{ fontFamily: "bold" }} className="mb-1">
                      {req.name}
                      {req.required ? " *" : ""}
                    </CText>
                    {req.description ? (
                      <CText className="text-gray-500 text-xs mb-2">
                        {req.description}
                      </CText>
                    ) : null}
                    {isFile ? (
                      <Pressable
                        onPress={() => pickFile(req.slug)}
                        className="px-4 py-3 rounded-xl bg-grey dark:bg-accent2"
                      >
                        <CText>
                          {kycFiles[req.slug]
                            ? kycFiles[req.slug].name
                            : "Choose image"}
                        </CText>
                      </Pressable>
                    ) : (
                      <TextInput
                        value={kycFields[req.slug] || ""}
                        onChangeText={(t) =>
                          setKycFields((prev) => ({ ...prev, [req.slug]: t }))
                        }
                        placeholder={req.provider_key || req.slug}
                        placeholderTextColor={isDarkMode ? "#888" : "#999"}
                        className="px-4 py-3 rounded-xl bg-grey dark:bg-accent2 text-primary"
                        keyboardType={
                          req.field_kind === "number" ? "number-pad" : "default"
                        }
                      />
                    )}
                  </View>
                );
              })}
              <Pressable
                onPress={submit}
                className="mt-2 mb-4 py-3 rounded-full bg-purple items-center"
              >
                <CText className="text-white" style={{ fontFamily: "bold" }}>
                  Submit
                </CText>
              </Pressable>
            </ScrollView>
          ) : null}

          {!busy && step === "done" && pendingWallet ? (
            <View className="py-4 gap-y-3">
              <CText className="text-center">
                {pendingWallet.type_name || selected?.name} —{" "}
                {pendingWallet.status}
              </CText>
              {pendingWallet.address ? (
                <CText className="text-center text-sm" selectable>
                  {pendingWallet.address}
                </CText>
              ) : null}
              {(pendingWallet.display_meta as any)?.note ? (
                <CText className="text-center text-gray-500 text-sm">
                  {String((pendingWallet.display_meta as any).note)}
                </CText>
              ) : null}
              <Pressable
                onPress={onClose}
                className="mt-4 py-3 rounded-full bg-purple items-center"
              >
                <CText className="text-white" style={{ fontFamily: "bold" }}>
                  Done
                </CText>
              </Pressable>
            </View>
          ) : null}
        </View>
      }
    />
  );
}
