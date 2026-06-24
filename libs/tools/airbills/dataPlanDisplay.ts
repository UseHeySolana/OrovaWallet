import type { InternetPlan } from "@/libs/tools/airbills/airbills";

export type DataPlanCategory =
  | "all"
  | "daily"
  | "weekly"
  | "monthly"
  | "ninety_days"
  | "broadband";

export const DATA_PLAN_CATEGORIES: { id: DataPlanCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "ninety_days", label: "90 Days" },
  { id: "broadband", label: "Broadband" },
];

/** Categories shown in Orova chat before listing plan widgets. */
export const CHAT_DATA_PLAN_CATEGORIES: {
  id: Exclude<DataPlanCategory, "all" | "broadband">;
  label: string;
}[] = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "ninety_days", label: "90 Days" },
];

export type DataPlanPickerRow = {
  prodId: string;
  prodName: string;
  prodAmount: number;
  sizeLabel: string;
  validityLabel: string;
  footerLabel?: string;
};

export type ParsedDataPlan = {
  plan: InternetPlan;
  sizeLabel: string;
  validityLabel: string;
  footerLabel?: string;
  category: DataPlanCategory;
};

export function formatPhoneDisplay(value: string) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
}

function extractSizeLabel(name: string) {
  const tbMatch = name.match(/(\d+(?:\.\d+)?)\s*TB/i);
  if (tbMatch) return `${tbMatch[1].replace(/\.0+$/, "")}TB`;
  const match = name.match(/([\d.]+)\s*(GB|MB)/i);
  if (!match) return "Data";
  const unit = match[2].toUpperCase();
  const amount = match[1].replace(/\.0+$/, "");
  return `${amount}${unit}`;
}

/** Parse validity length in days from any network's prodName pattern. */
export function extractValidityDays(name: string): number | null {
  const normalized = name.toLowerCase();

  if (normalized.includes("weekly")) return 7;

  const monthPlanMatch = normalized.match(/(\d+)\s*[- ]?month/);
  if (monthPlanMatch) return Number(monthPlanMatch[1]) * 30;

  if (normalized.includes("monthly")) return 30;

  const dayMatch = normalized.match(/(\d+)\s*days?/);
  if (dayMatch) return Number(dayMatch[1]);

  if (/1\s*day/.test(normalized)) return 1;
  if (/2[\s-]?days?/.test(normalized)) return 2;
  if (/3[\s-]?days?/.test(normalized)) return 3;

  return null;
}

function formatValidityLabel(days: number | null) {
  if (days == null) return "";
  if (days === 1) return "1 Day";
  if (days === 7) return "7 Days";
  if (days === 30) return "30 Days";
  if (days === 60) return "60 Days";
  if (days === 90) return "90 Days";
  if (days === 180) return "180 Days";
  if (days === 365) return "365 Days";
  return `${days} Days`;
}

function extractValidityLabel(name: string) {
  return formatValidityLabel(extractValidityDays(name));
}

function extractFooterLabel(name: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes("night")) return "Extra Night Data";
  const plusMatch = name.match(/(\+[^(-]+)/);
  if (plusMatch?.[1]) return plusMatch[1].trim();
  return undefined;
}

/** Group plans by validity window — works across MTN, Glo, 9mobile, Airtel naming. */
export function categorizeDataPlan(plan: InternetPlan): DataPlanCategory {
  const name = plan.prodName.toLowerCase();
  const days = extractValidityDays(plan.prodName);

  if (
    name.includes("broadband") ||
    name.includes("1tb") ||
    /\d+\s*tb/.test(name) ||
    (days != null && days > 45)
  ) {
    return "broadband";
  }

  if (days != null) {
    if (days <= 3) return "daily";
    if (days <= 14) return "weekly";
    if (days <= 59) return "monthly";
    if (days <= 120) return "ninety_days";
    return "broadband";
  }

  if (name.includes("monthly")) return "monthly";
  if (name.includes("weekly")) return "weekly";
  if (name.includes("daily") || name.includes("awoof")) return "daily";

  return "weekly";
}

export function parseDataPlan(plan: InternetPlan): ParsedDataPlan {
  const category = categorizeDataPlan(plan);
  return {
    plan,
    sizeLabel: extractSizeLabel(plan.prodName),
    validityLabel: extractValidityLabel(plan.prodName),
    footerLabel: extractFooterLabel(plan.prodName),
    category,
  };
}

export function filterPlansByCategory(
  parsedPlans: ParsedDataPlan[],
  category: DataPlanCategory
) {
  if (category === "all") return parsedPlans;
  return parsedPlans.filter((item) => item.category === category);
}

export function sortParsedPlans(plans: ParsedDataPlan[]) {
  return [...plans].sort((a, b) => {
    const amountDiff =
      Number(a.plan.prodAmount) - Number(b.plan.prodAmount);
    if (amountDiff !== 0) return amountDiff;
    return a.sizeLabel.localeCompare(b.sizeLabel);
  });
}

export function toDataPlanPickerRow(item: ParsedDataPlan): DataPlanPickerRow {
  return {
    prodId: item.plan.prodId,
    prodName: item.plan.prodName,
    prodAmount: Number(item.plan.prodAmount),
    sizeLabel: item.sizeLabel,
    validityLabel: item.validityLabel,
    footerLabel: item.footerLabel,
  };
}

const CHAT_CATEGORY_ALIASES: Record<string, DataPlanCategory> = {
  daily: "daily",
  day: "daily",
  weekly: "weekly",
  week: "weekly",
  monthly: "monthly",
  month: "monthly",
  "90 days": "ninety_days",
  "90 day": "ninety_days",
  "90days": "ninety_days",
  "90-day": "ninety_days",
  ninety: "ninety_days",
  "ninety days": "ninety_days",
};

export function resolveChatDataPlanCategory(
  value?: string
): Exclude<DataPlanCategory, "all" | "broadband"> | null {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  const direct = CHAT_CATEGORY_ALIASES[normalized];
  if (
    direct === "daily" ||
    direct === "weekly" ||
    direct === "monthly" ||
    direct === "ninety_days"
  ) {
    return direct;
  }
  return null;
}
