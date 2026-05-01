import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] pt-12 sm:px-6 md:pb-12 lg:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-heading text-xl font-semibold text-foreground">
            Nova Nail Studio
          </p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Personel ve yönetici paneli — randevu, müşteri ve finans süreçleri.
          </p>
        </div>
        <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
          <Link href="#" className="transition-colors hover:text-foreground">
            Gizlilik
          </Link>
          <Link href="#" className="transition-colors hover:text-foreground">
            Şartlar
          </Link>
          <span className="text-foreground/40">
            © {new Date().getFullYear()} Nova Nail Studio
          </span>
        </div>
      </div>
    </footer>
  );
}
