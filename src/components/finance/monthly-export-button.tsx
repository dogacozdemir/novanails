"use client";

import Download from "lucide-react/dist/esm/icons/download.mjs";
import Loader2 from "lucide-react/dist/esm/icons/loader-2.mjs";
import ExcelJS from "exceljs";
import { useState } from "react";

import { getMonthlyExportPayload } from "@/app/finance/actions";
import { Button } from "@/components/ui/button";

type Props = {
  monthISO: string;
};

function downloadBlob(filename: string, data: BlobPart) {
  const blob = new Blob([data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** SheetJS/xlsx yerine ExcelJS — güvenlik uyarılarından kaçınmak için */
function addJsonSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  rows: Record<string, unknown>[]
) {
  const ws = workbook.addWorksheet(sheetName);
  if (rows.length === 0) {
    ws.addRow(["Veri yok"]);
    return;
  }
  const headers = Object.keys(rows[0]);
  ws.addRow(headers);
  rows.forEach((row) => {
    ws.addRow(headers.map((h) => row[h]));
  });
}

export function MonthlyExportButton({ monthISO }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setPending(true);
    setError(null);
    try {
      const payload = await getMonthlyExportPayload(monthISO);

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Nova Nail Studio";

      addJsonSheet(workbook, "Gelirler", payload.revenues as Record<string, unknown>[]);
      addJsonSheet(workbook, "Giderler", payload.expenses as Record<string, unknown>[]);
      addJsonSheet(workbook, "Özet", [
        {
          Toplam_Ciro: payload.ozet.toplam_ciro,
          Toplam_Gider: payload.ozet.toplam_gider,
          Net_Kar: payload.ozet.net_kar,
        },
      ]);
      addJsonSheet(
        workbook,
        "Ödeme Yöntemleri",
        payload.odeme_yontemleri.map((r) => ({
          Yöntem: r.yontem,
          İşlem_Sayısı: r.islem_sayisi,
          Tutar: r.tutar,
        }))
      );

      const buf = await workbook.xlsx.writeBuffer();
      downloadBlob(`nova-finans-${monthISO}.xlsx`, buf);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dosya oluşturulamadı.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="gap-2 rounded-xl"
        disabled={pending}
        onClick={() => void handleDownload()}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Download className="size-4" aria-hidden />
        )}
        Excel olarak indir
      </Button>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
