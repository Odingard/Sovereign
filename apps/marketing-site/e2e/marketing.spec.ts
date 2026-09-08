import { type Page, expect, test } from "@playwright/test";

const primaryRoutes = [
  "/",
  "/product",
  "/platform",
  "/rheumatology",
  "/security",
  "/about",
  "/early-access",
];

const allRoutes = [...primaryRoutes, "/contact", "/privacy", "/terms"];

const screenshotMatrix = [
  { name: "desktop", width: 1440, height: 1000, routes: primaryRoutes },
  { name: "mobile", width: 390, height: 844, routes: primaryRoutes },
  { name: "tablet", width: 820, height: 1180, routes: ["/", "/rheumatology", "/product"] },
] as const;

function screenshotName(viewport: string, route: string) {
  const chapter = route === "/" ? "home" : route.slice(1);
  return `../../test-results/marketing-browser/screenshots/${viewport}-${chapter}.png`;
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

test.describe("Sovereign public narrative", () => {
  for (const route of allRoutes) {
    test(`${route} supports direct entry with one H1, metadata, and CTA`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page).toHaveTitle(/Sovereign/);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.+/);
      await expect(page.locator('a[href="/early-access"]').first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }

  test("desktop navigation reaches each narrative chapter", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    for (const [name, route] of [
      ["Product", "/product"],
      ["Platform", "/platform"],
      ["Rheumatology", "/rheumatology"],
      ["Security", "/security"],
      ["About", "/about"],
    ]) {
      await page.getByRole("link", { name, exact: true }).first().click();
      await expect(page).toHaveURL(new RegExp(`${route}$`));
    }
  });

  test("product views declare illustrative synthetic data", async ({ page }) => {
    await page.goto("/product");
    await expect(page.getByText("Illustrative product view").first()).toBeVisible();
    await expect(page.getByText("Synthetic data").first()).toBeVisible();
  });

  test("early-access form accepts business-only information", async ({ page }) => {
    await page.goto("/early-access");
    await page.getByLabel("First Name *").fill("Jane");
    await page.getByLabel("Last Name *").fill("Doe");
    await page.getByLabel("Work Email *").fill("jane@practice.example");
    await page.getByLabel("Practice or Organization Name *").fill("Illustrative Practice");
    await page.getByLabel("Your Role / Title *").selectOption("Rheumatologist / Physician");
    await page.getByLabel("Practice Size *").selectOption("3-5 clinicians");
    await page.getByLabel("Number of Practice Locations *").selectOption("2-4 locations");
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    await expect(page.locator('[name="patientName"], [name="mrn"], [name="dob"]')).toHaveCount(0);
    await page.waitForTimeout(1_100);
    await page.getByRole("button", { name: "Submit Early Access Request" }).click();
    await expect(page.getByText("Request Received")).toBeVisible();
  });

  test("reduced-motion mode remains readable and usable", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByRole("link", { name: "Request Early Access" }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

for (const viewport of screenshotMatrix) {
  test.describe(`${viewport.name} visual QA`, () => {
    for (const route of viewport.routes) {
      test(`${route} rendered screenshot`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(route);
        await page.screenshot({ path: screenshotName(viewport.name, route), fullPage: true });
        await expectNoHorizontalOverflow(page);
      });
    }
  });
}
