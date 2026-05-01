"use client";

import ChevronsUpDown from "lucide-react/dist/esm/icons/chevrons-up-down.mjs";
import Plus from "lucide-react/dist/esm/icons/plus.mjs";
import UserPlus from "lucide-react/dist/esm/icons/user-plus.mjs";
import { useCallback, useMemo, useState } from "react";

import type { CustomerBrief } from "@/app/appointments/actions";
import { CustomerQuickAddForm } from "@/components/customers/customer-quick-add-form";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function normalizePhoneDigits(p: string) {
  return p.replace(/\D/g, "");
}

function filterCustomers(list: CustomerBrief[], q: string) {
  const s = q.trim().toLowerCase();
  const digits = normalizePhoneDigits(q);
  if (!s && !digits) return list.slice(0, 80);
  return list.filter((c) => {
    const full = `${c.name} ${c.surname}`.toLowerCase();
    const phone = normalizePhoneDigits(c.phone ?? "");
    const phoneMatch =
      digits.length > 0 &&
      (phone.includes(digits) || phone.endsWith(digits.slice(-10)));
    return full.includes(s) || phoneMatch;
  });
}

function commitSelection(args: {
  customerId: string;
  onChange: (id: string | null) => void;
  setShowNew: (v: boolean) => void;
  setOpen: (v: boolean) => void;
}) {
  const { customerId, onChange, setShowNew, setOpen } = args;
  if (process.env.NODE_ENV === "development") {
    console.log("[CustomerCombobox] müşteri seçildi → onChange:", customerId);
  }
  onChange(customerId);
  setShowNew(false);
  setOpen(false);
}

type CustomerComboboxProps = {
  customers: CustomerBrief[];
  value: string | null;
  onChange: (customerId: string | null) => void;
  disabled?: boolean;
  /** Liste yenilendiğinde (örn. yeni müşteri kaydı sonrası) — tamamlanması beklenir */
  onCustomerListChange?: () => void | Promise<void>;
  /** Müşteri satırında küçük (+) ile hızlı yeni kayıt */
  compactQuickAdd?: boolean;
  /** Inline formda yalnızca Ad / Soyad / Telefon (kalıcı not alanı gizli) */
  minimalInlineForm?: boolean;
};

export function CustomerCombobox({
  customers,
  value,
  onChange,
  disabled,
  onCustomerListChange,
  compactQuickAdd = false,
  minimalInlineForm = false,
}: CustomerComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [quickSeed, setQuickSeed] = useState<{
    name?: string;
    surname?: string;
    phone?: string;
  } | null>(null);

  const selected = useMemo(
    () => customers.find((c) => c.id === value) ?? null,
    [customers, value]
  );

  const filtered = useMemo(
    () => filterCustomers(customers, search),
    [customers, search]
  );

  const triggerLabel = selected
    ? `${selected.name} ${selected.surname}`
    : "Müşteri seçin veya arayın…";

  const openNewFromQuery = useCallback(() => {
    const parts = search.trim().split(/\s+/).filter(Boolean);
    let name = "";
    let surname = "";
    if (parts.length >= 2) {
      name = parts[0] ?? "";
      surname = parts.slice(1).join(" ");
    } else {
      name = parts[0] ?? "";
      surname = "";
    }
    const digs = normalizePhoneDigits(search);
    const phone = digs.length >= 10 ? search.trim() : "";
    setQuickSeed({ name, surname, phone });
    setShowNew(true);
    setOpen(false);
  }, [search]);

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "gap-2",
          compactQuickAdd ? "flex items-start" : "contents"
        )}
      >
        <Popover
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (v) setSearch("");
          }}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={disabled}
              className={cn(
                "h-11 justify-between rounded-xl border-[var(--glass-border)] bg-[var(--glass-bg)] font-normal backdrop-blur-xl",
                compactQuickAdd ? "min-w-0 flex-1" : "w-full",
                !selected && "text-muted-foreground"
              )}
            >
              <span className="truncate">{triggerLabel}</span>
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
        <PopoverContent
          portalled={false}
          className="min-w-0 w-[var(--radix-popover-trigger-width)] max-h-[min(320px,50vh)] overflow-hidden p-0"
          align="start"
          style={{ pointerEvents: "auto" }}
          data-customer-combobox-popover=""
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
        >
          <div className="flex flex-col">
            <div className="flex items-center border-b border-[var(--glass-border)] px-3">
              <input
                type="text"
                autoComplete="off"
                placeholder="Ad, soyad veya telefon…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="flex h-11 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div
              role="listbox"
              className="max-h-[240px] overflow-y-auto overflow-x-hidden p-1"
            >
              {filtered.length === 0 ? (
                <div className="flex flex-col gap-2 px-3 py-4">
                  <p className="text-center text-xs text-muted-foreground">
                    Kayıtlı müşteri bulunamadı.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full gap-2 rounded-xl"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openNewFromQuery();
                    }}
                  >
                    <UserPlus className="size-4" />
                    Yeni Müşteri Ekle
                  </Button>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <p className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Müşteriler
                  </p>
                  {filtered.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      role="option"
                      aria-selected={value === c.id}
                      className={cn(
                        "flex w-full flex-col gap-0.5 rounded-lg px-2 py-2 text-left text-sm outline-none transition-colors",
                        "hover:bg-black/[0.06] focus-visible:bg-black/[0.06] dark:hover:bg-white/[0.08] dark:focus-visible:bg-white/[0.08]",
                        value === c.id && "bg-black/[0.06] dark:bg-white/[0.08]"
                      )}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const ne = e.nativeEvent;
                        ne.stopImmediatePropagation();
                        commitSelection({
                          customerId: c.id,
                          onChange,
                          setShowNew,
                          setOpen,
                        });
                      }}
                    >
                      <span className="font-medium">
                        {c.name} {c.surname}
                      </span>
                      {c.phone ? (
                        <span className="text-xs text-muted-foreground">
                          {c.phone}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
              {filtered.length > 0 && search.trim().length > 0 ? (
                <div className="border-t border-[var(--glass-border)] p-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 rounded-lg text-xs"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openNewFromQuery();
                    }}
                  >
                    <UserPlus className="size-3.5 shrink-0" />
                    Listede yok mu? Yeni müşteri ekle
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {compactQuickAdd ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          className="h-11 w-11 shrink-0 rounded-xl border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl"
          aria-label="Yeni müşteri ekle"
          title="Yeni müşteri ekle"
          onClick={() => {
            setOpen(false);
            setQuickSeed({ name: "", surname: "", phone: "" });
            setShowNew(true);
          }}
        >
          <Plus className="size-4" strokeWidth={2} />
        </Button>
      ) : null}
      </div>

      {showNew ? (
        <div className="liquid-glass-v2 shadow-diffuse space-y-3 rounded-[1.25rem] p-4">
          <CustomerQuickAddForm
            seed={quickSeed ?? undefined}
            showProfileNotes={!minimalInlineForm}
            submitLabel="Kaydet ve bu randevuya bağla"
            disabled={disabled}
            onCancel={() => {
              setShowNew(false);
              setQuickSeed(null);
            }}
            onSuccess={async (id) => {
              if (process.env.NODE_ENV === "development") {
                console.log("[CustomerCombobox] yeni müşteri → onChange:", id);
              }
              onChange(id);
              setShowNew(false);
              setQuickSeed(null);
              setSearch("");
              try {
                await onCustomerListChange?.();
              } catch {
                /* üst bileşen refresh hatası — seçim yine de geçerli */
              }
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
