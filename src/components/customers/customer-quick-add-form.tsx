"use client";

import Loader2 from "lucide-react/dist/esm/icons/loader-2.mjs";
import { useEffect, useState } from "react";

import { createCustomer } from "@/app/customers/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type CustomerQuickAddFormProps = {
  /** Kayıt sonrası çağrılır (yeni müşteri id) */
  onSuccess: (customerId: string) => void | Promise<void>;
  onCancel?: () => void;
  /** Gönder düğmesi metni */
  submitLabel?: string;
  /** Kalıcı müşteri notu alanını göster */
  showProfileNotes?: boolean;
  disabled?: boolean;
  className?: string;
  /** Alanları doldurmak için (ör. arama çubuğundan gelen öneri) */
  seed?: { name?: string; surname?: string; phone?: string } | null;
};

export function CustomerQuickAddForm({
  onSuccess,
  onCancel,
  submitLabel = "Kaydet",
  showProfileNotes = true,
  disabled = false,
  className,
  seed,
}: CustomerQuickAddFormProps) {
  const [name, setName] = useState(seed?.name ?? "");
  const [surname, setSurname] = useState(seed?.surname ?? "");
  const [phone, setPhone] = useState(seed?.phone ?? "");
  const [profileNotes, setProfileNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!seed) return;
    setName(seed.name ?? "");
    setSurname(seed.surname ?? "");
    setPhone(seed.phone ?? "");
  }, [seed]);

  const reset = () => {
    setName("");
    setSurname("");
    setPhone("");
    setProfileNotes("");
    setError(null);
  };

  const submit = async () => {
    if (!name.trim() || !surname.trim()) {
      setError("Ad ve soyad zorunludur.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { id } = await createCustomer({
        name: name.trim(),
        surname: surname.trim(),
        phone: phone.trim() || null,
        notes: showProfileNotes ? profileNotes.trim() || null : null,
      });
      reset();
      await onSuccess(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {onCancel ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Yeni müşteri
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            disabled={busy || disabled}
            onClick={onCancel}
          >
            Vazgeç
          </Button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground">
            Ad
          </span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Örn. Ayşe"
            className="h-10 rounded-xl"
            disabled={busy || disabled}
          />
        </div>
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground">
            Soyad
          </span>
          <Input
            value={surname}
            onChange={(e) => setSurname(e.target.value)}
            placeholder="Örn. Yılmaz"
            className="h-10 rounded-xl"
            disabled={busy || disabled}
          />
        </div>
      </div>

      <div className="space-y-1">
        <span className="text-[11px] font-medium text-muted-foreground">
          Telefon
        </span>
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="05xx xxx xx xx"
          className="h-10 rounded-xl"
          disabled={busy || disabled}
        />
      </div>

      {showProfileNotes ? (
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground">
            Müşteriye özel kalıcı not
          </span>
          <Textarea
            value={profileNotes}
            onChange={(e) => setProfileNotes(e.target.value)}
            placeholder="Alerji, oje tercihi, hassasiyet vb."
            className="min-h-[72px] rounded-xl text-sm"
            disabled={busy || disabled}
          />
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      <Button
        type="button"
        className="w-full rounded-xl shadow-glass-inner"
        disabled={busy || disabled}
        onClick={() => void submit()}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          submitLabel
        )}
      </Button>
    </div>
  );
}
