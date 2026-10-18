"use client";

// Replaces the root layout when it fails, so it brings its own <html> and plain styling.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <main style={{ maxWidth: 420, margin: "0 auto", padding: "20vh 24px" }}>
          <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>Something went wrong</h1>
          <p style={{ color: "#555", lineHeight: 1.5 }}>
            The app hit an unexpected problem. Nothing you entered has been changed. Please try again.
          </p>
          {error.digest ? <p style={{ color: "#777", fontSize: 12 }}>Reference: {error.digest}</p> : null}
          <button
            onClick={reset}
            style={{ marginTop: 12, padding: "8px 16px", borderRadius: 8, border: 0, background: "#171717", color: "#fff", cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
