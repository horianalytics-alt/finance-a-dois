import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  clearLocalSession,
  readHideValues,
  readLocalSession,
  writeHideValues,
  writeLocalSession,
  type LocalSession,
} from "@/lib/local-session";

export type Profile = {
  id: string;
  user_id: string;
  family_id: string;
  name: string;
  avatar_url: string | null;
};

export type Family = { id: string; code: string };

export type Category = {
  id: string;
  family_id: string;
  name: string;
  type: "receita" | "despesa" | "investimento";
  sort_order: number;
};

export type PaymentMethod = {
  id: string;
  family_id: string;
  name: string;
  sort_order: number;
};

export type Transaction = {
  id: string;
  family_id: string;
  profile_id: string;
  user_id: string;
  type: "receita" | "despesa" | "investimento";
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  created_time: string; // ISO
  category_id: string | null;
  payment_method_id: string | null;
  is_paid: boolean;
  is_benefit: boolean;
  recurrence_months: number;
  recurrence_index: number;
  recurrence_parent_id: string | null;
  paid_date: string | null;
};

interface AppContextValue {
  loading: boolean;
  needsOnboarding: boolean;
  profile: Profile | null;
  family: Family | null;
  members: Profile[];
  categories: Category[];
  paymentMethods: PaymentMethod[];
  transactions: Transaction[];
  hideValues: boolean;
  toggleHideValues: () => void;
  refresh: () => Promise<void>;
  resetLocal: () => void;
  setLocalAfterOnboarding: (s: LocalSession) => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [hideValues, setHideValues] = useState(false);

  useEffect(() => {
    setHideValues(readHideValues());
  }, []);

  const toggleHideValues = useCallback(() => {
    setHideValues((v) => {
      const next = !v;
      writeHideValues(next);
      return next;
    });
  }, []);

  const loadAll = useCallback(async (familyId: string) => {
    const [memRes, catRes, pmRes, txRes, famRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("family_id", familyId),
      supabase.from("categories").select("*").eq("family_id", familyId).order("sort_order"),
      supabase.from("payment_methods").select("*").eq("family_id", familyId).order("sort_order"),
      supabase.from("transactions").select("*").eq("family_id", familyId).order("date", { ascending: false }),
      supabase.from("families").select("*").eq("id", familyId).maybeSingle(),
    ]);
    if (memRes.data) setMembers(memRes.data as Profile[]);
    if (catRes.data) setCategories(catRes.data as Category[]);
    if (pmRes.data) setPaymentMethods(pmRes.data as PaymentMethod[]);
    if (txRes.data) setTransactions(txRes.data as Transaction[]);
    if (famRes.data) setFamily(famRes.data as Family);
  }, []);

  const refresh = useCallback(async () => {
    if (!session) return;
    const { data: prof } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (!prof) {
      setProfile(null);
      setFamily(null);
      setMembers([]);
      setCategories([]);
      setPaymentMethods([]);
      setTransactions([]);
      return;
    }
    const p = prof as Profile;
    setProfile(p);
    writeLocalSession({
      family_id: p.family_id,
      profile_id: p.id,
      family_code: "",
      profile_name: p.name,
    });
    await loadAll(p.family_id);
  }, [session, loadAll]);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      setLoading(false);
      setProfile(null);
      setFamily(null);
      return;
    }
    setLoading(true);
    // tenta hidratar do localStorage primeiro (ux mais rápida)
    const local = readLocalSession();
    if (local) {
      loadAll(local.family_id).catch(() => {});
    }
    refresh().finally(() => setLoading(false));
  }, [session, authLoading, refresh, loadAll]);

  const setLocalAfterOnboarding = useCallback(
    async (s: LocalSession) => {
      writeLocalSession(s);
      await refresh();
    },
    [refresh],
  );

  const resetLocal = useCallback(() => {
    clearLocalSession();
    setProfile(null);
    setFamily(null);
    setMembers([]);
    setCategories([]);
    setPaymentMethods([]);
    setTransactions([]);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      loading: authLoading || loading,
      needsOnboarding: !!session && !profile && !loading,
      profile,
      family,
      members,
      categories,
      paymentMethods,
      transactions,
      hideValues,
      toggleHideValues,
      refresh,
      resetLocal,
      setLocalAfterOnboarding,
    }),
    [
      authLoading,
      loading,
      session,
      profile,
      family,
      members,
      categories,
      paymentMethods,
      transactions,
      hideValues,
      toggleHideValues,
      refresh,
      resetLocal,
      setLocalAfterOnboarding,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
