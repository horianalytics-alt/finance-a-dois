import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";

export type FamilySettings = {
  futile_label: string;
  interest_poupanca: number;
  interest_cdi: number;
  interest_custom: number;
  interest_custom_label: string;
  monthly_income: number;
};

const DEFAULTS: FamilySettings = {
  futile_label: "Bobeiras",
  interest_poupanca: 6,
  interest_cdi: 10,
  interest_custom: 12,
  interest_custom_label: "Personalizada",
  monthly_income: 0,
};

export function useFamilySettings() {
  const { family } = useApp();
  const [settings, setSettings] = useState<FamilySettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!family?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("family_settings")
      .select("key, value")
      .eq("family_id", family.id);
    if (!error && data) {
      const merged = { ...DEFAULTS };
      for (const row of data) {
        const k = row.key as keyof FamilySettings;
        if (k === "futile_label" || k === "interest_custom_label") {
          (merged as Record<string, unknown>)[k] = row.value;
        } else {
          const n = Number(row.value);
          if (Number.isFinite(n)) (merged as Record<string, unknown>)[k] = n;
        }
      }
      setSettings(merged);
    }
    setLoading(false);
  }, [family?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(
    async (patch: Partial<FamilySettings>) => {
      if (!family?.id) return;
      const rows = Object.entries(patch).map(([key, value]) => ({
        family_id: family.id,
        key,
        value: String(value),
      }));
      const { error } = await supabase
        .from("family_settings")
        .upsert(rows, { onConflict: "family_id,key" });
      if (!error) {
        setSettings((prev) => ({ ...prev, ...patch }));
      }
      return error;
    },
    [family?.id],
  );

  return { settings, loading, refresh, save };
}
