import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createJSONStorage, persist } from "zustand/middleware";

export interface PajCashBeneficiary {
  id: string;
  backendId?: number;
  bankId: string;
  bankName: string;
  bankCode?: string;
  accountNumber: string;
  accountName: string;
  updatedAt: number;
}

interface PajCashBeneficiariesState {
  beneficiaries: PajCashBeneficiary[];
  setBeneficiaries: (beneficiaries: PajCashBeneficiary[]) => void;
  upsertBeneficiary: (beneficiary: Omit<PajCashBeneficiary, "id" | "updatedAt">) => void;
  removeBeneficiary: (id: string) => void;
  clearBeneficiaries: () => void;
}

function beneficiaryId(bankId: string, accountNumber: string) {
  return `${bankId}:${accountNumber}`;
}

const PajCashBeneficiaries = create<PajCashBeneficiariesState>()(
  persist(
    (set) => ({
      beneficiaries: [],
      setBeneficiaries: (beneficiaries) =>
        set({
          beneficiaries: [...beneficiaries].sort(
            (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
          ),
        }),
      upsertBeneficiary: (beneficiary) =>
        set((state) => {
          const id = beneficiaryId(beneficiary.bankId, beneficiary.accountNumber);
          const next: PajCashBeneficiary = {
            ...beneficiary,
            id,
            updatedAt: Date.now(),
          };
          const rest = state.beneficiaries.filter((item) => item.id !== id);
          return { beneficiaries: [next, ...rest].slice(0, 20) };
        }),
      removeBeneficiary: (id) =>
        set((state) => ({
          beneficiaries: state.beneficiaries.filter((item) => item.id !== id),
        })),
      clearBeneficiaries: () => set({ beneficiaries: [] }),
    }),
    {
      name: "pajcash-beneficiaries",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default PajCashBeneficiaries;
