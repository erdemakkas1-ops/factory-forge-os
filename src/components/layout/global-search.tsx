import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { fullName } from "@/lib/permissions";

type Result = { id: string; label: string; hint: string; to: string };

/**
 * Global arama. Faz 1'de personel, departman ve birim kayıtları üzerinde
 * çalışır; yeni modüller eklendikçe sonuç kaynakları genişletilir.
 */
export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const query = term.trim();

  const { data, isFetching } = useQuery({
    queryKey: ["global-search", query],
    enabled: open && query.length >= 2,
    queryFn: async () => {
      const like = `%${query}%`;
      const [people, deps, units] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, first_name, last_name, employee_no, position")
          .or(
            `first_name.ilike.${like},last_name.ilike.${like},employee_no.ilike.${like},position.ilike.${like}`,
          )
          .limit(6),
        supabase
          .from("departments")
          .select("id, name, code")
          .or(`name.ilike.${like},code.ilike.${like}`)
          .limit(6),
        supabase
          .from("units")
          .select("id, name, code")
          .or(`name.ilike.${like},code.ilike.${like}`)
          .limit(6),
      ]);

      return {
        people: (people.data ?? []).map<Result>((p) => ({
          id: p.id,
          label: fullName(p) || (p.employee_no ?? "Personel"),
          hint: [p.employee_no, p.position].filter(Boolean).join(" • "),
          to: `/personel/${p.id}`,
        })),
        org: [
          ...(deps.data ?? []).map<Result>((d) => ({
            id: d.id,
            label: d.name,
            hint: `Departman • ${d.code}`,
            to: "/organizasyon",
          })),
          ...(units.data ?? []).map<Result>((u) => ({
            id: u.id,
            label: u.name,
            hint: `Birim • ${u.code}`,
            to: "/organizasyon",
          })),
        ],
      };
    },
  });

  const empty = useMemo(
    () => (data?.people.length ?? 0) + (data?.org.length ?? 0) === 0,
    [data],
  );

  function go(to: string) {
    setOpen(false);
    setTerm("");
    void navigate({ to });
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="w-full justify-start gap-2 text-muted-foreground sm:w-64 lg:w-80"
      >
        <Search className="size-4" />
        <span className="truncate">Personel, departman, birim ara...</span>
        <kbd className="ml-auto hidden rounded border px-1.5 text-[10px] lg:inline">⌘K</kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          value={term}
          onValueChange={setTerm}
          placeholder="En az 2 karakter yazın..."
        />
        <CommandList>
          {query.length < 2 ? (
            <CommandEmpty>Aramak için en az 2 karakter girin.</CommandEmpty>
          ) : isFetching ? (
            <CommandEmpty>Aranıyor...</CommandEmpty>
          ) : empty ? (
            <CommandEmpty>Sonuç bulunamadı.</CommandEmpty>
          ) : null}

          {data?.people.length ? (
            <CommandGroup heading="Personel">
              {data.people.map((r) => (
                <CommandItem key={r.id} value={r.id} onSelect={() => go(r.to)}>
                  <span>{r.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{r.hint}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {data?.org.length ? (
            <CommandGroup heading="Organizasyon">
              {data.org.map((r) => (
                <CommandItem key={r.id} value={r.id} onSelect={() => go(r.to)}>
                  <span>{r.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{r.hint}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      </CommandDialog>
    </>
  );
}
