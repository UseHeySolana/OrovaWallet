export interface ConfirmationOptions {
    message: string;
    subtitle?: string;
    type?: 'fingerprint' | 'passcode' | null
  }
  
  let confirmFn: ((options: ConfirmationOptions) => Promise<boolean>) | null = null;
  
  export const setConfirmFn = (fn: (options: ConfirmationOptions) => Promise<boolean>) => {
    confirmFn = fn;
  };
  
  export const confirm = (options: ConfirmationOptions): Promise<boolean> => {
    if (!confirmFn) {
      throw new Error("Confirm function not initialized. Ensure ConfirmationModal is mounted.");
    }
    return confirmFn(options);
  };
  