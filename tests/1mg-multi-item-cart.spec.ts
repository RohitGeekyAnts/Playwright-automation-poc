import { expect, test } from "@playwright/test";
import { HomePage } from "../pages/HomePage";
import { SearchResultsPage } from "../pages/SearchResultsPage";
import { ProductPage } from "../pages/ProductPage";
import { CartPage } from "../pages/CartPage";

test("Flow 3: Multi-item cart, coupon reconciliation, and UI price validation", async ({
  page,
}) => {
  // Generous timeout for heavy UI and slower browsers
  test.setTimeout(180000);

  const homePage = new HomePage(page);
  const searchPage = new SearchResultsPage(page);
  const productPage = new ProductPage(page);
  const cartPage = new CartPage(page);

  // --- TEST DATA ---
  const testItems = [
    { search: "dolo 650 tablet", qty: 3 },
    { search: "volini pain relief gel", qty: 2 },
    { search: "vicks vaporub", qty: 1 },
  ];
  const capturedCartItems: any[] = [];

  // ==========================================
  // STEP 1: Set City Explicitly
  // ==========================================
  await homePage.navigate();
  await homePage.openLocationDropdownAndGetCities();
  await homePage.selectCity("Mumbai");
  await expect(homePage.locationSelectorBtn).toHaveValue("Mumbai");

  console.log("Step 1 Complete: City set to Mumbai");

  // Pause the test here so you can confirm the baseline works
  // ==========================================
  // STEP 2: Search, Add, Capture, and Check Badge
  // ==========================================
  for (let i = 0; i < testItems.length; i++) {
    const item = testItems[i];
    console.log(`Processing item ${i + 1}: ${item.search}`);

    // Search for the item
    await homePage.searchFor(item.search);

    // Open the first organic result
    await searchPage.openProductByIndex(0);
    await page.waitForLoadState("domcontentloaded");

    // Capture the exact PDP details (Price, Name, Pack Size)
    const pdpDetails = await productPage.getFullProductDetails();

    // Add to cart (this will now safely handle the "Substitute" popup if it appears)
    await productPage.clickAddButton();

    // Get the active quantity button and check its current value
    const qtyLocator = await productPage.getActiveQuantityLocator();
    const currentQtyText = await qtyLocator.innerText();

    // Only open the dropdown to change quantity if it doesn't already match
    if (!currentQtyText.includes(item.qty.toString())) {
      await productPage.changeQuantity(qtyLocator, item.qty);
    }

    // Ensure the UI reflects the updated quantity
    await productPage.validateQuantityState(item.qty);

    // Save the details for the math reconciliation in our final step
    capturedCartItems.push({
      ...pdpDetails,
      requestedQty: item.qty,
    });

    // STEP 3: Assert the cart badge increments to the distinct-item count (1, then 2, then 3)
    // Wrapping in a retry block (.toPass) in case the network call is slightly delayed
    await expect(async () => {
      const badgeCount = await homePage.getCartBadgeCount();
      expect(badgeCount).toBe(i + 1); // 1st item = 1, 2nd item = 2, etc.
    }).toPass({ timeout: 10000 });
  }

  // Quick console log to verify our data capture worked
  console.log("Successfully captured items:", capturedCartItems);

  // Pause here to verify all 3 items were added successfully!
  await page.pause();
});
