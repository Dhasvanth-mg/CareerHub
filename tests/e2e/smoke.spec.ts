import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PUBLIC_PAGES = ["/", "/login", "/signup", "/forgot-password", "/check-email"];

const PROTECTED = [
  "/dashboard",
  "/applications",
  "/applications/new",
  "/tasks",
  "/calendar",
  "/contacts",
  "/jobs",
  "/resume",
  "/cover-letter",
  "/documents",
  "/analytics",
  "/action-center",
  "/evidence",
  "/offers",
  "/planner",
  "/settings",
  "/api/export",
];

test.describe("public pages", () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path} renders and has no serious accessibility violations`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.locator("h1").first()).toBeVisible();

      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    });
  }

  test("pages have no horizontal scroll on a phone", async ({ page }) => {
    for (const path of ["/", "/login", "/signup"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow, `${path} overflows horizontally`).toBe(false);
    }
  });
});

test.describe("runtime health", () => {
  for (const path of [...PUBLIC_PAGES, "/privacy", "/terms"]) {
    test(`${path} has no script errors or CSP violations`, async ({ page }) => {
      const problems: string[] = [];
      page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() === "error" || /content security policy/i.test(m.text())) problems.push(`console: ${m.text()}`);
      });
      await page.goto(path, { waitUntil: "networkidle" });
      expect(problems).toEqual([]);
    });
  }
});

test.describe("signed-out access control", () => {
  for (const path of PROTECTED) {
    test(`${path} sends visitors to the login page`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login\?/);
      await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    });
  }

  test("a forged reset or confirmation link lands on login with an error", async ({ page }) => {
    for (const url of ["/auth/confirm?token_hash=bogus&type=recovery", "/auth/confirm?type=recovery", "/auth/callback?code=bogus"]) {
      await page.goto(url);
      await expect(page).toHaveURL(/\/login\?error=link/);
      await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
    }
  });

  test("the auth callback never redirects off-site", async ({ page }) => {
    await page.goto("/auth/callback?code=bogus&next=//evil.example");
    expect(new URL(page.url()).origin).toBe("http://localhost:3100");
  });

  test("reset-password is not reachable without a session", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("forms keep what people typed", () => {
  test("a rejected login keeps the email field filled in", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue("not-an-email");
  });

  test("signup rejects a short password with a clear message", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Email").fill("person@example.com");
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Sign up" }).click();
    await expect(page.getByText("Password must be at least 8 characters.")).toBeVisible();
  });
});

test.describe("hardening", () => {
  test("unknown routes show a helpful not-found page", async ({ page }) => {
    // Signed-out visitors are sent to login for unknown private paths, so use a public prefix.
    const res = await page.goto("/privacy/this-page-does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("responses carry security headers", async ({ request }) => {
    const res = await request.get("/login");
    const h = res.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["content-security-policy"]).toContain("object-src 'none'");
    expect(h["permissions-policy"]).toContain("camera=()");
  });

  test("the health endpoint answers without a session", async ({ request }) => {
    const res = await request.get("/api/health");
    expect([200, 503]).toContain(res.status());
    expect(await res.json()).toHaveProperty("status");
  });

  test("privacy and terms pages are public", async ({ page }) => {
    for (const path of ["/privacy", "/terms"]) {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.locator("h1").first()).toBeVisible();
    }
  });
});

test.describe("forms never put typed values in the address bar", () => {
  // Without JavaScript (or before the page finishes loading) a form falls back to a plain browser
  // submit. That must never be a GET, which would put a password into the URL and browser history.
  test.use({ javaScriptEnabled: false });

  for (const path of ["/login", "/signup"]) {
    test(`${path} submits as POST when scripts have not run`, async ({ page }) => {
      await page.goto(path);
      await page.getByLabel("Email").fill("person@example.com");
      await page.getByLabel("Password").fill("a-secret-password-123");
      await page.getByRole("button", { name: /log in|sign up/i }).click();
      await page.waitForLoadState();
      expect(page.url()).not.toContain("password");
      expect(page.url()).not.toContain("a-secret-password");
      expect(page.url()).not.toContain("person%40example.com");
    });
  }
});
