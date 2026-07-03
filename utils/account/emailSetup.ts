import type { UserType } from "@/utils/types/user.types";

export function userMissingBackupEmail(user: UserType | null | undefined): boolean {
  if (!user) return false;
  return !user.email?.trim();
}
