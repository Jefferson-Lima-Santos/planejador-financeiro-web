import { supabase } from "@/lib/supabase";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

export const USER_PREFERENCE_THEME_MODE = "theme_mode";

const isMissingPreferencesTableError = (error: { code?: string; message?: string }) =>
  error.code === "PGRST205" ||
  error.code === "42P01" ||
  error.message?.includes("Could not find the table 'public.user_preferences'") === true;

export async function getUserPreference<T extends JsonValue>(preferenceKey: string) {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("user_preferences")
    .select("value_json")
    .eq("preference_key", preferenceKey)
    .maybeSingle();

  if (error) {
    if (isMissingPreferencesTableError(error)) {
      return null;
    }

    throw error;
  }

  return (data?.value_json as T | undefined) ?? null;
}

export async function upsertUserPreference(
  preferenceKey: string,
  value: JsonValue
): Promise<void> {
  if (!supabase) {
    return;
  }

  const timestamp = new Date().toISOString();
  const { error } = await supabase.from("user_preferences").upsert(
    {
      preference_key: preferenceKey,
      updated_at: timestamp,
      value_json: value,
    },
    {
      onConflict: "user_id,preference_key",
    }
  );

  if (error) {
    if (isMissingPreferencesTableError(error)) {
      return;
    }

    throw error;
  }
}
