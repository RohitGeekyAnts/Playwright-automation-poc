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
  expect(page.url()).not.toBe("https://www.1mg.com/");

  // STEP 5: Validate PDP
  const pdpTitle = await productPage.getProductTitle();
  expect(pdpTitle.toLowerCase()).toContain(cardTitleSnippet.toLowerCase());

  // STEP 6: Add to Cart & Validate Quantity
  await productPage.clickAddButton();
  const activeOneAddedLocator = await productPage.validateQuantityState(1);

  // STEP 7: Increase Quantity to 3
  await productPage.changeQuantity(activeOneAddedLocator, 3);
  await productPage.validateQuantityState(3);

  // STEP 8: Go to Cart
  await productPage.goToCart();
  expect(page.url()).toContain("/cart");

  // STEP 9: Validate Cart & Checkout
  await cartPage.validateItemExists(cardTitleSnippet);
  await cartPage.proceedToCheckout();
  await cartPage.validateLoginModalVisible();
});
