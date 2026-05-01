"use client";

import X from "lucide-react/dist/esm/icons/x.mjs";
import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";

type GlassSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function GlassSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: GlassSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-[102] bg-black/30 backdrop-blur-md",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
        />
        <Dialog.Content
          className={cn(
            "glass-modal-surface fixed inset-y-0 right-0 z-[103] flex h-full w-full max-w-md flex-col border-l border-[var(--glass-border)] shadow-glass-lg focus:outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-300 ease-out",
            className
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-[var(--glass-border)] px-6 py-5">
            <div className="space-y-1 pr-8">
              <Dialog.Title className="font-heading text-xl font-semibold tracking-tight text-foreground">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="text-sm text-muted-foreground">
                  {description}
                </Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">
                  Randevu detayı
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 rounded-xl"
                aria-label="Kapat"
              >
                <X className="size-5" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="flex flex-1 flex-col overflow-y-auto px-6 py-6">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
