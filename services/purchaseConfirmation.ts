export interface PurchaseConfirmationProductDetails {
  name?: string;
  base_price: number;
  delivery_fee: number;
  currency?: string;
}

export interface PurchaseConfirmationOptions {
  productDetails: PurchaseConfirmationProductDetails;
  source: "jumia" | "crossmint";
}

let purchaseConfirmFn: ((options: PurchaseConfirmationOptions) => Promise<boolean>) | null = null;

export const setPurchaseConfirmFn = (
  fn: (options: PurchaseConfirmationOptions) => Promise<boolean>
) => {
  purchaseConfirmFn = fn;
};

export const requestPurchaseConfirmation = (
  options: PurchaseConfirmationOptions
): Promise<boolean> => {
  if (!purchaseConfirmFn) {
    console.warn("[purchaseConfirmation] Sheet not mounted; treating as cancelled.");
    return Promise.resolve(false);
  }
  return purchaseConfirmFn(options);
};
