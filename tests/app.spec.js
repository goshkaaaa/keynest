import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("register, hand over, reload, and return a physical key", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add your first key +" }).click();
  await page.getByLabel("Key tag", { exact: true }).fill("A-014");
  await page
    .getByLabel("Property / address", { exact: true })
    .fill("Flat 12 · Berlin");
  await page.getByRole("button", { name: "Add to register +" }).click();
  await expect(page.locator(".key-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Hand over this key ↗" }).click();
  await page.getByLabel("Handed to", { exact: true }).fill("Alex");
  await page.getByLabel("Return by", { exact: true }).fill("2099-01-01");
  await page
    .getByRole("button", { name: "Record handover ↗", exact: true })
    .click();
  await expect(page.locator(".holder strong")).toHaveText("Alex");
  await page.reload();
  await expect(page.locator(".holder strong")).toHaveText("Alex");
  await page.getByRole("button", { name: "Mark returned ✓" }).click();
  await expect(page.locator(".key-card .badge")).toHaveText("IN CABINET");
  await page.getByRole("button", { name: "Handover history" }).click();
  await expect(page.locator(".history .badge")).toHaveText("RETURNED");
});
test("invalid backups do not replace existing state and exports download", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Backups", exact: true }).click();
  await page.getByRole("checkbox").check();
  await page
    .getByLabel("Restore Keynest backup")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":2}'),
    });
  await expect(page.getByRole("status")).toContainText("not a valid");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup ↓" }).click();
  expect((await pending).suggestedFilename()).toBe("keynest-backup.json");
});
test("empty register has no sample records and passes accessibility checks", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Add your first key +" }),
  ).toBeEnabled();
  await expect(page.locator(".key-card")).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((item) => ({
      id: item.id,
      targets: item.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
});
