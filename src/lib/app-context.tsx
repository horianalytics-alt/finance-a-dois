import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  clearLocalSession,
  readHideValues,
  readLocalSession,
  writeHideValues,
  writeLocalSession,
  type LocalSession,
} from "@/lib/local-session";
import {
  clearActiveProfileId,
  readActiveProfileId,
  writeActiveProfileId,
} from "@/lib/active-profile";
import { playPartner } from "@/lib/sounds";

export type Profile = {
  id: string;
  user_id: string;
  family_id: string;
  name: string;
  avatar_url: string | null;
  settings?: Record<string, unknown> | null;
};

export type Family = { id: string; code: string };

export type TxType = "receita" | "despesa" | "investimento";

export type Category = {
  id: string;
  family_id: string;
  name: string;
  type: TxType;
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
  profile_id: string; // OWNER
  created_by_id: string; // AUTOR
  user_id: string;
  type: TxType;
  description: string;
  amount: number;
  date: string;
  created_time: string;
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
  family: Family | null;
  members: Profile[];
  activeProfile: Profile | null;
  setActiveProfile: (id: string) => void;
  categories: Category[];
  paymentMethods: PaymentMethod[];
  transactions: Transaction[];
  hideValues: boolean;
  toggleHideValues: () => void;
  onlineProfiles: Set<string>;
  /** IDs de transações inseridas via realtime que ainda estão "novas" (badge amarelo) */
  newTxIds: Set<string>;
  acknowledgeNewTx: (id?: string) => void;
  refresh: () => Promise<void>;
  resetLocal: () => void;
  setLocalAfterOnboarding: (s: LocalSession) => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

const NEW_TX_TTL_MS = 5000;

export function AppProvider({ children }: { children: ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [hideValues, setHideValues] = useState(false);
  const [onlineProfiles, setOnlineProfiles] = useState<Set<string>>(new Set());
  const [newTxIds, setNewTxIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setHideValues(readHideValues());
    setActiveProfileIdState(readActiveProfileId());
  }, []);

  const toggleHideValues = useCallback(() => {
    setHideValues((v) => {
      const next = !v;
      writeHideValues(next);
      return next;
    });
  }, []);

  const setActiveProfile = useCallback((id: string) => {
    writeActiveProfileId(id);
    setActiveProfileIdState(id);
  }, []);

  const acknowledgeNewTx = useCallback((id?: string) => {
    setNewTxIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      if (id) next.delete(id);
      else next.clear();
      return next;
    });
  }, []);

  const loadAll = useCallback(async (familyId: string) => {
    const [memRes, catRes, pmRes, txRes, famRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("family_id", familyId).order("created_at"),
      supabase.from("categories").select("*").eq("family_id", familyId).order("sort_order"),
      supabase.from("payment_methods").select("*").eq("family_id", familyId).order("sort_order"),
      supabase.from("transactions").select("*").eq("family_id", familyId).order("date", { ascending: false }).limit(2000),
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
    const { data: profs } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at");
    if (!profs || profs.length === 0) {
      setFamily(null);
      setMembers([]);
      setCategories([]);
      setPaymentMethods([]);
      setTransactions([]);
      return;
    }
    const list = profs as Profile[];
    const familyId = list[0].family_id;
    const stored = readActiveProfileId();
    const valid = stored && list.find((p) => p.id === stored);
    if (!valid) setActiveProfile(list[0].id);
    writeLocalSession({
      family_id: familyId,
      profile_id: stored && valid ? stored : list[0].id,
      family_code: "",
      profile_name: list[0].name,
    });
    await loadAll(familyId);
  }, [session, loadAll, setActiveProfile]);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      setLoading(false);
      setFamily(null);
      setMembers([]);
      return;
    }
    setLoading(true);
    const local = readLocalSession();
    if (local) loadAll(local.family_id).catch(() => {});
    refresh().finally(() => setLoading(false));
  }, [session, authLoading, refresh, loadAll]);

  // ================ REALTIME: transactions ====================
  const lastInsertHandledRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!family || !activeProfileId) return;
    const channel = supabase
      .channel(`tx:${family.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "transactions", filter: `family_id=eq.${family.id}` },
        (payload) => {
          const row = payload.new as Transaction;
          if (lastInsertHandledRef.current.has(row.id)) return;
          lastInsertHandledRef.current.add(row.id);
          setTransactions((prev) => (prev.some((t) => t.id === row.id) ? prev : [row, ...prev]));
          // Notifica somente se foi inserida POR OUTRO perfil (autor != ativo)
          if (row.created_by_id !== activeProfileId) {
            // marca como "novo" e dispara expiração
            setNewTxIds((s) => {
              const next = new Set(s);
              next.add(row.id);
              return next;
            });
            window.setTimeout(() => {
              setNewTxIds((s) => {
                if (!s.has(row.id)) return s;
                const next = new Set(s);
                next.delete(row.id);
                return next;
              });
            }, NEW_TX_TTL_MS);
            // som distinto do "success" do próprio usuário
            try {
              playPartner();
            } catch {
              /* noop */
            }
            setMembers((mem) => {
              const author = mem.find((m) => m.id === row.created_by_id);
              const sign = row.type === "receita" ? "+" : row.type === "despesa" ? "-" : "•";
              const valor = new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(Number(row.amount));
              toast(`${author?.name ?? "Parceiro(a)"} adicionou`, {
                description: `${row.description} ${sign}${valor}`,
              });
              return mem;
            });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "transactions", filter: `family_id=eq.${family.id}` },
        (payload) => {
          const row = payload.new as Transaction;
          setTransactions((prev) => prev.map((t) => (t.id === row.id ? row : t)));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "transactions", filter: `family_id=eq.${family.id}` },
        (payload) => {
          const old = payload.old as { id: string };
          setTransactions((prev) => prev.filter((t) => t.id !== old.id));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [family, activeProfileId]);

  // ============== REALTIME: profiles ====================
  useEffect(() => {
    if (!family) return;
    const ch = supabase
      .channel(`profiles:${family.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `family_id=eq.${family.id}` },
        () => {
          supabase
            .from("profiles")
            .select("*")
            .eq("family_id", family.id)
            .order("created_at")
            .then(({ data }) => {
              if (data) setMembers(data as Profile[]);
            });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [family]);

  // ============== PRESENCE =====================
  useEffect(() => {
    if (!family || !activeProfileId) return;
    const channel = supabase.channel(`presence:${family.id}`, {
      config: { presence: { key: activeProfileId } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const ids = new Set<string>(Object.keys(state));
        setOnlineProfiles(ids);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await channel.track({ at: Date.now() });
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [family, activeProfileId]);

  const setLocalAfterOnboarding = useCallback(
    async (s: LocalSession) => {
      writeLocalSession(s);
      await refresh();
    },
    [refresh],
  );

  const resetLocal = useCallback(() => {
    clearLocalSession();
    clearActiveProfileId();
    setFamily(null);
    setMembers([]);
    setActiveProfileIdState(null);
    setCategories([]);
    setPaymentMethods([]);
    setTransactions([]);
  }, []);

  const activeProfile = useMemo(
    () => members.find((m) => m.id === activeProfileId) ?? members[0] ?? null,
    [members, activeProfileId],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      loading: authLoading || loading,
      needsOnboarding: !!session && members.length === 0 && !loading,
      family,
      members,
      activeProfile,
      setActiveProfile,
      categories,
      paymentMethods,
      transactions,
      hideValues,
      toggleHideValues,
      onlineProfiles,
      newTxIds,
      acknowledgeNewTx,
      refresh,
      resetLocal,
      setLocalAfterOnboarding,
    }),
    [
      authLoading,
      loading,
      session,
      family,
      members,
      activeProfile,
      setActiveProfile,
      categories,
      paymentMethods,
      transactions,
      hideValues,
      toggleHideValues,
      onlineProfiles,
      newTxIds,
      acknowledgeNewTx,
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
