import { ImageSource } from "expo-image";

export type AppImage = string | ImageSource | number;

export interface AppToolParamOption {
  value: string;
  name: string;
}

export interface AppToolParam {
  name: string;
  type: string;
  label?: string;
  placeholder?: string;
  helper?: string;
  optional?: boolean;
  secure?: boolean;
  multiline?: boolean;
  options?: AppToolParamOption[];
}

export interface AppToolAction {
  type?: string;
  route?: string;
  action_id?: string;
  /** Local-only executable handler resolved from the capability registry. Never from remote. */
  url?: (...args: any[]) => any;
  params?: AppToolParam[];
}

export interface AppToolDefinition {
  name: string;
  params: AppToolParam[];
  action?: AppToolAction;
}

/** Serializable catalog fields (safe from backend). */
export interface AppManifest {
  slug: string;
  name: string;
  category: string;
  short_des: string;
  description: string;
  tutorial?: string;
  url: string;
  tags: string[];
  descriptionImages: AppImage[];
  is_active: boolean;
  is_featured: boolean;
  is_new: boolean;
  ratings: number;
  user_count?: number;
  review_count?: number;
  dashboardRoute?: string;
  brand_colors?: {
    primary: string;
    secondary: string;
  };
  tools?: AppToolDefinition[];
  capability_ids?: string[];
  minimum_client_version?: string | null;
  platforms?: string[];
  icon_url?: string | null;
  banner_url?: string | null;
  sort_order?: number;
  /** Bundled fallback only: beta apps stay hidden until remote catalog grants access. */
  visibility?: "public" | "beta";
}

/** Resolved app used by the wallet UI (manifest + local assets/actions). */
export interface App extends AppManifest {
  banner: AppImage;
  icon: AppImage;
  descriptionImages: AppImage[];
}

export interface RemoteAppRegistration {
  id?: number;
  slug: string;
  name: string;
  category: string;
  short_description?: string | null;
  description?: string | null;
  website_url?: string | null;
  tutorial_url?: string | null;
  dashboard_route?: string | null;
  icon_url?: string | null;
  banner_url?: string | null;
  tags?: string[];
  description_images?: string[];
  brand_colors?: { primary?: string; secondary?: string } | null;
  tools?: AppToolDefinition[];
  capability_ids?: string[];
  status?: string;
  is_featured?: boolean;
  is_new?: boolean;
  sort_order?: number;
  ratings?: number;
  user_count?: number;
  review_count?: number;
  minimum_client_version?: string | null;
  platforms?: string[];
  visibility?: "public" | "beta";
}

/** Alias kept for older imports. */
export type AppManifestSerializable = Omit<AppManifest, "descriptionImages"> & {
  descriptionImages: string[];
};
