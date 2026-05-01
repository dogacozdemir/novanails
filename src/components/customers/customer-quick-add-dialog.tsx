"use client";

import UserPlus from "lucide-react/dist/esm/icons/user-plus.mjs";
import X from "lucide-react/dist/esm/icons/x.mjs";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";

import { CustomerQuickAddForm } from "@/components/customers/customer-quick-add-form";
import { Button } from "@/components/ui/button";
import {
  NOVA_DIALOG_DESCRIPTION,
  NOVA_DIALOG_TITLE,
  NOVA_GLASS_DIALOG_OVERLAY,
  NOVA_GLASS_DIALOG_PANEL,
} from "@/lib/glass-dialog-classes";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CustomerQuickAddDialog({ open, onOpenChange }: Props) {
  const router = useRouter();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={NOVA_GLASS_DIALOG_OVERLAY} />
        <Dialog.Content
          className={NOVA_GLASS_DIALOG_PANEL}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <UserPlus className="size-[1.15rem]" strokeWidth={2} />
              </span>
              <Dialog.Title className={NOVA_DIALOG_TITLE}>
                Yeni müşteri
              </Dialog.Title>
            </div>
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
            Ad, soyad ve telefon ile kayıt oluşturun; liste anında güncellenir.
          </Dialog.Description>

          <div className="mt-6">
            <CustomerQuickAddForm
              showProfileNotes
              submitLabel="Müşteriyi kaydet"
              onSuccess={async () => {
                onOpenChange(false);
                router.refresh();
              }}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
