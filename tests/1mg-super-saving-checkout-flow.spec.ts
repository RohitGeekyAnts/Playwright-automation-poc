import { expect, test } from "@playwright/test";
import { HomePage } from "../pages/HomePage";
import { ProductPage } from "../pages/ProductPage";
import { CartPage } from "../pages/CartPage";

test("1mg E2E Flow - Super saving deals Carousel to Checkout", async ({
  page,
}) => {
  const homePage = new HomePage(page);
  const productPage = new ProductPage(page);
  const cartPage = new CartPage(page);

  // STEP 1 & 2: Navigate and reach the deals section
  await homePage.navigate();
  await homePage.scrollToDealsSection();
  await expect(homePage.dealsSectionTitle).toBeVisible();

  // STEP 3 & 4: Navigate carousel and open the 2nd to last product
  const cardTitleSnippet = await homePage.openDealProductFromEnd(2);

  // REFACTORED: Using async web-first assertion. It will smartly poll until
  // the URL changes, preventing failures on slow network connections.
  await expect(page).not.toHaveURL("https://www.1mg.com/");

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

  // REFACTORED: Using Regex (/. *\/cart/) with an async assertion to poll for the cart page URL
  await expect(page).toHaveURL(/.*\/cart/);

  // STEP 9: Validate Cart & Checkout
  await cartPage.validateItemExists(cardTitleSnippet);
  await cartPage.proceedToCheckout();
  await cartPage.validateLoginModalVisible();
});
