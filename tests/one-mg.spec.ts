import { expect, test } from "@playwright/test";

test("1mg E2E Flow - Super saving deals Carousel to Checkout", async ({
  page,
}) => {
  // STEP 1: Navigation & Initial Load
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/https:\/\/www\.1mg\.com\/?$/);

  const screenOverlay = page.locator(".bg_power_overlay.show");
  try {
    await screenOverlay.waitFor({ state: "visible", timeout: 3000 });
    await page.locator('.bg_power_close, [aria-label="Close"]').first().click();
    await screenOverlay.waitFor({ state: "hidden", timeout: 3000 });
  } catch (error) {}

  // STEP 2 & 3: Scroll & Modals
  const sectionTitle = page
    .getByRole("heading", { name: /super saving deals/i })
    .first();
  await sectionTitle.scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 500);

  if (await screenOverlay.isVisible()) {
    await page.locator('.bg_power_close, [aria-label="Close"]').first().click();
    await screenOverlay.waitFor({ state: "hidden", timeout: 3000 });
  }

  await expect(sectionTitle).toBeVisible();

  // STEP 4: Carousel Navigation
  await page
    .getByText("₹")
    .first()
    .waitFor({ state: "visible", timeout: 10000 });

  const sectionContainer = page
    .locator("div")
    .filter({ has: sectionTitle })
    .filter({ has: page.getByText("See all", { exact: false }) })
    .first();

  const productCards = sectionContainer.locator("a").filter({ hasText: "₹" });
  await productCards.first().waitFor({ state: "attached", timeout: 5000 });

  const totalItems = await productCards.count();
  const targetCard = productCards.nth(totalItems - 2);

  const nextArrow = sectionContainer
    .locator(
      '[class*="slider-arrow-right"], .slick-next, [aria-label="Next"], svg',
    )
    .filter({ hasText: ">" })
    .or(
      sectionContainer.locator(
        '[class*="slider-arrow-right"], .slick-next, [aria-label="Next"]',
      ),
    )
    .first();

  while (!(await targetCard.isVisible())) {
    await sectionContainer.hover();
    if (await nextArrow.isVisible()) {
      await nextArrow.click();
      await page.waitForTimeout(600);
    } else {
      break;
    }
  }

  const productText = await targetCard.innerText();
  const cardTitleSnippet = productText.split("\n")[0].trim().replace("...", "");

  // STEP 5: Navigate to PDP
  const productHref = await targetCard.getAttribute("href");
  if (!productHref) {
    throw new Error("Could not find the 'href' attribute on the product card!");
  }

  await page.goto(productHref, { waitUntil: "domcontentloaded" });
  expect(page.url()).not.toBe("https://www.1mg.com/");

  // STEP 6: Validate PDP Details
  const pdpTitleElement = page.locator("h1").first();
  await pdpTitleElement.waitFor({ state: "visible", timeout: 5000 });
  const pdpTitleText = await pdpTitleElement.innerText();
  expect(pdpTitleText.toLowerCase()).toContain(cardTitleSnippet.toLowerCase());

  // STEP 7: Click "ADD" Button
  await page.waitForTimeout(2000);
  const addButtons = page.getByText("ADD", { exact: true });

  await expect(async () => {
    let clicked = false;
    for (let i = 0; i < (await addButtons.count()); i++) {
      if (await addButtons.nth(i).isVisible()) {
        await addButtons.nth(i).click();
        clicked = true;
        break;
      }
    }
    expect(clicked).toBeTruthy();
  }).toPass({ timeout: 5000 });

  // STEP 8: Validate Default Quantity is 1
  const oneAddedElements = page.getByText(/1\s*Added/i);
  let activeOneAddedLocator = oneAddedElements.first();

  await expect(async () => {
    let found = false;
    for (let i = 0; i < (await oneAddedElements.count()); i++) {
      if (await oneAddedElements.nth(i).isVisible()) {
        activeOneAddedLocator = oneAddedElements.nth(i);
        found = true;
        break;
      }
    }
    expect(found).toBeTruthy();
  }).toPass({ timeout: 8000 });

  // STEP 9: Increase Quantity to 3
  await activeOneAddedLocator.click();

  const quantityModal = page
    .locator("div")
    .filter({ has: page.getByText("Select Quantity") })
    .filter({ has: page.getByText("Remove") })
    .last();

  const option3 = quantityModal.getByText("3", { exact: true }).first();
  await option3.click();
  await page.waitForTimeout(1000);

  // STEP 10: Validate Quantity is 3
  const threeAddedElements = page.getByText(/3\s*Added/i);

  await expect(async () => {
    let found = false;
    for (let i = 0; i < (await threeAddedElements.count()); i++) {
      if (await threeAddedElements.nth(i).isVisible()) {
        found = true;
        break;
      }
    }
    expect(found).toBeTruthy();
  }).toPass({ timeout: 8000 });

  // STEP 11: Navigate to Cart
  const cartIcon = page.locator('a[href="/cart"]').first();
  await cartIcon.click({ force: true });
  await page.waitForLoadState("domcontentloaded");
  expect(page.url()).toContain("/cart");

  // STEP 12: Validate Cart Details
  const cartItemTitle = page
    .getByText(cardTitleSnippet, { exact: false })
    .first();
  await expect(cartItemTitle).toBeVisible({ timeout: 5000 });

  // STEP 13: Checkout & Validate Login Modal
  const checkoutBtn = page
    .locator('a[href*="/checkout"]')
    .or(
      page.locator("a, button, div").filter({ hasText: /CHECKOUT|CONTINUE/i }),
    )
    .last();

  await checkoutBtn.waitFor({ state: "visible", timeout: 5000 });
  await checkoutBtn.click({ force: true });

  const loginModal = page.getByText("Login", { exact: true }).first();
  await expect(loginModal).toBeVisible({ timeout: 5000 });
});
