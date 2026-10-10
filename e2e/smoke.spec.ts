import { expect, test } from "@playwright/test";

test("home offers the three modes", async ({ page }) => {
  await page.goto("/");
  for (const mode of ["Flights", "Hotels", "AI Planner"]) await expect(page.getByRole("heading", { name: mode, exact: true })).toBeVisible();
  await page.getByRole("link", { name: /Open Hotels/ }).click();
  await expect(page).toHaveURL(/\/hotels$/);
});

test("settings saves a place", async ({ page }) => {
  await page.goto("/settings");
  await page.getByLabel("Name", { exact: true }).fill("Office");
  await page.getByLabel("Address", { exact: true }).fill("Av. da Liberdade 110, Lisbon");
  await page.getByRole("button", { name: /Add place/ }).click();
  await expect(page.getByText("Office", { exact: true })).toBeVisible();
});

test("hotels: search, open a hotel, load prices and reviews", async ({ page }) => {
  await page.goto("/hotels");
  await page.getByLabel("Destination").fill("Lisbon");
  await page.getByRole("button", { name: /Search stays/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "stays" })).toBeVisible();
  await page.getByRole("button", { name: /Memmo Alfama/ }).first().click();
  await page.getByRole("button", { name: /Show booking prices/ }).click();
  await expect(page.getByText(/Typical price here/)).toBeVisible();
  await page.getByRole("tab", { name: "Google reviews" }).click();
  await page.getByRole("button", { name: /Load Google reviews/ }).click();
  await expect(page.getByRole("button", { name: /More reviews/ })).toBeVisible();
});

test("AI planner: understand, estimate, research and rank", async ({ page }) => {
  await page.goto("/ai");
  await page.getByLabel("Describe your stay").fill("Hotel in Lisbon for 10 nights from March 3, quiet, under $300 a night");
  await page.getByRole("button", { name: /Plan my stay/ }).click();
  await expect(page.getByText("Here's what I understood")).toBeVisible();
  await expect(page.getByText(/of your 40-credit limit/)).toBeVisible();
  await page.getByRole("button", { name: /Run research/ }).click();
  await expect(page.getByText(/options checked/)).toBeVisible({ timeout: 45_000 });
  await expect(page.locator("article")).toHaveCount(4);
});

test("flights: cash fares in every cabin, then award seats", async ({ page }) => {
  await page.goto("/flights");
  await page.getByLabel("From", { exact: true }).first().fill("New York");
  await page.getByRole("option", { name: /New York \(all airports\)/ }).click();
  await page.getByLabel("To", { exact: true }).first().fill("LIS");
  await page.getByRole("button", { name: /Search fares/ }).click();
  for (const cabin of ["Economy", "Premium Economy", "Business", "First"]) await expect(page.getByRole("tab", { name: new RegExp(`^${cabin}`) })).toContainText("from");
  await page.getByRole("tab", { name: /Points/ }).click();
  await page.getByRole("button", { name: /Search award seats/ }).click();
  await expect(page.getByText(/award calendar/)).toBeVisible();
});
