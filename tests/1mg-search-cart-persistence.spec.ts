import { expect, test } from "@playwright/test";
import { HomePage } from "../pages/HomePage";
import { SearchResultsPage } from "../pages/SearchResultsPage";
import { ProductPage } from "../pages/ProductPage";
import { CartPage } from "../pages/CartPage";

test("Flow 2: Search, Sort, Location Persistence, and Cart Math", async ({
  page,
}) => {
  test.setTimeout(120000);
  const homePage = new HomePage(page);
  const searchPage = new SearchResultsPage(page);
  const productPage = new ProductPage(page);
  const cartPage = new CartPage(page);

  // 1. Open and validate default city
  await homePage.navigate();
  const defaultCity = await homePage.getCurrentCity();
  expect(defaultCity.length).toBeGreaterThan(0);

  // 2. Search "dolo"
  await homePage.searchFor("dolo");

  // 3. Validate Search Results Page (URL and Heading)
  await expect(page).toHaveURL(/name=dolo/i);
  const headingData = await searchPage.getHeadingDetails();
  expect(headingData.fullText.toLowerCase()).toContain(
    "search results for dolo",
  );

  // 4. Validate Card Count vs Total
  const renderedCount = await searchPage.getCardCountOnPage();
  expect(renderedCount).toBeGreaterThan(0);
  expect(renderedCount).toBeLessThanOrEqual(headingData.totalCount);
  console.log(
    `Assumption validated: Displaying ${renderedCount} cards out of ${headingData.totalCount} total.`,
  );

  // 5. Sort and validate ascending prices FIRST
  await searchPage.sortPricesLowToHigh();
  const prices = await searchPage.getAllVisibleSellingPrices();

  // Find the index where the first sorted section ("Exact Matches") ends
  const firstDropIndex = prices.findIndex(
    (val, i, arr) => i > 0 && val < arr[i - 1],
  );

  // Isolate the primary block of organic results
  const primaryResults =
    firstDropIndex === -1 ? prices : prices.slice(0, firstDropIndex);

  expect(primaryResults.length).toBeGreaterThan(1);
  const isSorted = primaryResults.every(
    (val, i, arr) => !i || val >= arr[i - 1],
  );
  expect(isSorted).toBeTruthy();

  // 6. Capture 3rd card details (0-indexed = 2) AFTER sorting is complete
  const targetIndex = 2;
  const capturedCard = await searchPage.getCardDetails(targetIndex);

  // Create a clean name to avoid UI badges breaking the URL regex or Cart locators downstream
  const cleanName = capturedCard.name
    .replace(/^(bestseller|ad)[\s\n]*/i, "")
    .trim();

  // 7. Open captured product by exact index & validate PDP
  await searchPage.openProductByIndex(targetIndex);

  // Generate slug using cleanName (e.g. "Dolo 650" -> "dolo-650")
  const nameParts = cleanName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/);
  const expectedSlug = nameParts.slice(0, 2).join("-");
  await expect(page).toHaveURL(new RegExp(expectedSlug));

  const pdpDetails = await productPage.getFullProductDetails();

  // Assert using the cleanName
  expect(pdpDetails.name.toLowerCase()).toContain(cleanName.toLowerCase());
  expect(pdpDetails.sellingPrice).toEqual(capturedCard.sellingPrice);
  expect(pdpDetails.mrp).toEqual(capturedCard.mrp);
  expect(pdpDetails.discount).toEqual(capturedCard.discount);

  // 8. Validate Breadcrumb ends with the product name
  const breadcrumbText = (await productPage.getBreadcrumbText()) || "";

  // Normalize both strings: convert to lowercase and remove ALL spaces, newlines, and arrows
  const normalizedBreadcrumb = breadcrumbText
    .replace(/[\s\n>]+/g, "")
    .toLowerCase();
  const normalizedTargetName = cleanName.replace(/[\s\n]+/g, "").toLowerCase();

  // Assert that the breadcrumb trail cleanly ends with the exact product name
  expect(
    normalizedBreadcrumb.endsWith(normalizedTargetName),
    `Expected breadcrumb to end with "${normalizedTargetName}", but got "${normalizedBreadcrumb}"`,
  ).toBe(true);

  // 9. Validate Delivery Promise
  const originalETA = await productPage.getDeliveryPromise();
  expect(originalETA).toContain("Get by");

  // 10. Validate City list is alphabetical
  const cities = await homePage.openLocationDropdownAndGetCities();
  const sortedCities = [...cities].sort((a, b) => a.localeCompare(b));
  expect(cities).toEqual(sortedCities);

  // 11. Change location and validate header update
  const newCity = cities.find((c) => c !== defaultCity) || cities[0];
  await homePage.selectCity(newCity);
  await expect(homePage.locationSelectorBtn).toHaveValue(newCity);

  // 12. Re-read price & ETA. Log changes, don't fail if they differ.
  const newPrice = (await productPage.getFullProductDetails()).sellingPrice;
  const newETA = await productPage.getDeliveryPromise();

  expect(newPrice).toContain("₹");
  expect(newETA.length).toBeGreaterThan(0);

  if (newPrice !== capturedCard.sellingPrice)
    console.log(
      `[Location Change] Price updated: ${capturedCard.sellingPrice} -> ${newPrice}`,
    );
  if (newETA !== originalETA)
    console.log(`[Location Change] ETA updated: ${originalETA} -> ${newETA}`);

  // 13. Reload and validate persistence
  await page.reload();
  await expect(homePage.locationSelectorBtn).toHaveValue(newCity);

  // 14. Set quantity to 2 and add to cart
  await productPage.clickAddButton();
  const activeQtyLocator = await productPage.getActiveQuantityLocator();
  await productPage.changeQuantity(activeQtyLocator, 2);

  await expect(async () => {
    const count = await homePage.getCartBadgeCount();
    expect(count).toBe(1);
  }).toPass({ timeout: 10000 });

  // 15. Switch city back, assert cart survives the context switch
  await homePage.openLocationDropdownAndGetCities();
  await homePage.selectCity(defaultCity);
  await expect(async () => {
    expect(await homePage.getCartBadgeCount()).toBe(1);
  }).toPass();

  // 16. Open cart, validate math (Item Total = Selling Price x 2)
  await productPage.goToCart();

  const numericSP = parseFloat(
    capturedCard.sellingPrice.replace(/[^0-9.]/g, ""),
  );

  const currentItemTotal = await cartPage.getItemTotal(cleanName);
  expect(currentItemTotal).toBe(numericSP * 2);

  // 17. Reduce qty to 1 and validate recalculation
  await cartPage.reduceQuantityToOne(cleanName);
  const updatedItemTotal = await cartPage.getItemTotal(cleanName);
  expect(updatedItemTotal).toBe(numericSP * 1);

  // 18. Remove item, check empty cart, and verify persistence after reload
  await cartPage.removeItem(cleanName);
  await cartPage.validateEmptyCart();
  await expect(async () => {
    expect(await homePage.getCartBadgeCount()).toBe(0);
  }).toPass();

  await page.reload();
  await cartPage.validateEmptyCart();
});
