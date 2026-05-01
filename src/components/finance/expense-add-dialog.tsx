"use client";

import Loader2 from "lucide-react/dist/esm/icons/loader-2.mjs";
import Plus from "lucide-react/dist/esm/icons/plus.mjs";
import X from "lucide-react/dist/esm/icons/x.mjs";
import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

import { createExpense } from "@/app/finance/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EXPENSE_CATEGORY_OPTIONS } from "@/lib/expense-category-labels";
import {
  NOVA_DIALOG_DESCRIPTION,
  NOVA_DIALOG_TITLE,
  NOVA_GLASS_DIALOG_OVERLAY,
  NOVA_GLASS_DIALOG_PANEL,
} from "@/lib/glass-dialog-classes";
import { istanbulDateISO } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { ExpenseCategory } from "@/types/database";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

export function ExpenseAddDialog({ open, onOpenChange, onCreated }: Props) {
  const [date, setDate] = useState(() => istanbulDateISO());
  const [category, setCategory] = useState<ExpenseCategory>("other");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setDate(istanbulDateISO());
    setCategory("other");
    setAmount("");
    setDescription("");
    setError(null);
  };

  const submit = async () => {
    const num = parseFloat(amount.replace(",", "."));
    if (Number.isNaN(num) || num < 0) {
      setError("Geçerli tutar girin.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createExpense({
        expense_date: date,
        category,
        amount: num,
        description: description.trim() || null,
      });
      reset();
      onCreated();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={NOVA_GLASS_DIALOG_OVERLAY} />
        <Dialog.Content
          className={NOVA_GLASS_DIALOG_PANEL}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className={NOVA_DIALOG_TITLE}>
              Gider ekle
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-xl"
                aria-label="Kapat"
              >
                <X className="size-5" />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className={NOVA_DIALOG_DESCRIPTION}>
            Kategori ve tutarı kaydedin; raporlarda görünür.
          </Dialog.Description>

          <div className="mt-6 flex flex-col gap-4">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                Tarih
              </span>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                Kategori
              </span>
              <select
                className={cn(
                  "flex h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 text-sm backdrop-blur-xl",
                  "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                )}
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as ExpenseCategory)
                }
                disabled={busy}
              >
                {EXPENSE_CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                Tutar (₺)
              </span>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                disabled={busy}
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                Açıklama
              </span>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="İsteğe bağlı"
                disabled={busy}
                className="min-h-[80px]"
              />
            </div>
            {error ? (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : null}
            <Button
              type="button"
              className="w-full rounded-xl shadow-glass-inner"
              disabled={busy}
              onClick={() => void submit()}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <Plus className="mr-2 size-4" />
                  Kaydet
                </>
              )}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
