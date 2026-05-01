"use client";

/**
 * Tam `globals.css` çekilmez — çöküş anında küçük HTML + inline stil (Lighthouse / ana paket).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const devDetail =
    process.env.NODE_ENV === "development"
      ? error.message
      : error.digest
        ? `Kod: ${error.digest}`
        : null;

  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          fontFamily:
            'ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif',
          background: "#f5f1e9",
          color: "#1a1a1a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
        }}
      >
        <div
          style={{
            maxWidth: "26rem",
            width: "100%",
            borderRadius: "1.35rem",
            border: "1px solid rgba(26,26,26,0.12)",
            background: "rgba(255,255,255,0.92)",
            padding: "2.25rem 2rem",
            textAlign: "center",
            boxShadow:
              "0 24px 64px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.7)",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
            Nova Nail Studio
          </h1>
          <p
            style={{
              marginTop: "0.75rem",
              fontSize: "0.875rem",
              lineHeight: 1.6,
              color: "rgba(26,26,26,0.65)",
            }}
          >
            Beklenmedik bir kesinti veya hata oluştu. Bağlantınızı kontrol edip
            yeniden deneyebilirsiniz.
          </p>
          <button
            type="button"
            style={{
              marginTop: "1.75rem",
              width: "100%",
              borderRadius: "0.75rem",
              border: "none",
              background: "#1a1a1a",
              color: "#f5f1e9",
              padding: "0.75rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
            onClick={() => reset()}
          >
            Yeniden yükle
          </button>
          {devDetail ? (
            <pre
              style={{
                marginTop: "1.25rem",
                maxHeight: "8rem",
                overflow: "auto",
                borderRadius: "0.75rem",
                background: "rgba(26,26,26,0.06)",
                padding: "0.75rem",
                fontSize: "11px",
                lineHeight: 1.45,
                textAlign: "left",
                color: "rgba(26,26,26,0.7)",
              }}
            >
              {devDetail}
            </pre>
          ) : null}
        </div>
      </body>
    </html>
  );
}
