import { expect, test } from "@playwright/test";
import { HomePage } from "../pages/HomePage";
import { ProductPage } from "../pages/ProductPage";
import { CartPage } from "../pages/CartPage";

test("1mg E2E Flow - Super saving deals Carousel to Checkout", async ({
  page,
}) => {
  test.setTimeout(120000);
  const homePage = new HomePage(page);
  const productPage = new ProductPage(page);
  const cartPage = new CartPage(page);

  // STEP 1 & 2: Navigate and reach the deals section
  await homePage.navigate();
  await homePage.scrollToDealsSection();
  await expect(homePage.dealsSectionTitle).toBeVisible();

  // STEP 3 & 4: Navigate carousel and open the 2nd to last product
  const cardTitleSnippet = await homePage.openDealProductFromEnd(2);

  // FIX: Use Regex to ensure it works regardless of trailing slashes or query parameters
  // We wait for the URL to NOT be the base homepage URL.
  await expect(page).not.toHaveURL(/^https:\/\/www\.1mg\.com\/?(\?.*)?$/);

  // Ensure the new page has fully loaded before attempting to read the PDP title
  await page.waitForLoadState("domcontentloaded");

  // STEP 5: Validate PDP
  const pdpTitle = await productPage.getProductTitle();
  expect(pdpTitle.toLowerCase()).toContain(cardTitleSnippet.toLowerCase());

  // STEP 6: Add to Cart & Fetch Active Locator (Handles dynamic default quantities)
  await productPage.clickAddButton();
  const activeQtyLocator = await productPage.getActiveQuantityLocator();

  // STEP 7: Increase Quantity to 3 & Validate
  await productPage.changeQuantity(activeQtyLocator, 3);
  await productPage.validateQuantityState(3);

  // STEP 8: Go to Cart
  await productPage.goToCart();

  // FIX: Assert on a stable UI element (the Cart heading) instead of a strict URL regex
  await expect(page.getByRole("heading", { name: /^Cart$/i })).toBeVisible({
    timeout: 15000,
  });

  // STEP 9: Validate Cart & Checkout
  await cartPage.validateItemExists(cardTitleSnippet);
  await cartPage.proceedToCheckout();
  await cartPage.validateLoginModalVisible();
});
