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

  // ==========================================
  // STEP 2: Search, Add, Capture, and Check Badge
  // ==========================================
  for (let i = 0; i < testItems.length; i++) {
    const item = testItems[i];
    console.log(`Processing item ${i + 1}: ${item.search}`);

    await homePage.searchFor(item.search);
    await searchPage.openProductByIndex(0);
    await page.waitForLoadState("domcontentloaded");

    const pdpDetails = await productPage.getFullProductDetails();
    await productPage.clickAddButton();

    const qtyLocator = await productPage.getActiveQuantityLocator();
    const currentQtyText = await qtyLocator.innerText();

    if (!currentQtyText.includes(item.qty.toString())) {
      await productPage.changeQuantity(qtyLocator, item.qty);
    }

    await productPage.validateQuantityState(item.qty);

    capturedCartItems.push({
      ...pdpDetails,
      requestedQty: item.qty,
    });

    // STEP 3: Assert the cart badge increments
    await expect(async () => {
      const badgeCount = await homePage.getCartBadgeCount();
      expect(badgeCount).toBe(i + 1);
    }).toPass({ timeout: 10000 });
  }

  console.log("Successfully captured items:", capturedCartItems);

  // ==========================================
  // STEP 4: Cart Navigation & Line Item Verification
  // ==========================================
  await productPage.goToCart();
  await expect(page.getByRole("heading", { name: /^Cart$/i })).toBeVisible({
    timeout: 15000,
  });

  for (const item of capturedCartItems) {
    if (item.name) {
      await cartPage.validateItemExists(item.name);
    }
  }

  // ==========================================
  // STEP 5: Assert Subtotal = Sum of all line totals (MRP) from DOM
  // ==========================================
  // Extract all visible original prices (strike elements represent MRP/Original prices in cart rows)
  const cartItemPrices = await page
    .locator("a div.flex.alignBaseline strike")
    .allTextContents();

  let expectedMrpSubtotal = 0;
  for (const priceText of cartItemPrices) {
    const numericVal = parseFloat(priceText.replace(/[^0-9.]/g, ""));
    if (!isNaN(numericVal)) {
      expectedMrpSubtotal += numericVal;
    }
  }

  // Fallback: if items don't have strike elements, pull main displayed prices
  if (expectedMrpSubtotal === 0) {
    for (const item of capturedCartItems) {
      const mrpStr = item.mrp || item.sellingPrice || "0";
      const mrpPrice = parseFloat(mrpStr.replace(/[^0-9.]/g, ""));
      expectedMrpSubtotal += mrpPrice * item.requestedQty;
    }
  }

  console.log(`Expected Math Subtotal (MRP): ₹${expectedMrpSubtotal}`);

  const summaryRow = page
    .locator(".flex.justifyBetween")
    .filter({ hasText: "Item total (MRP)" });
  await summaryRow.waitFor({ state: "visible", timeout: 10000 });
  const rowText = await summaryRow.textContent();

  const match = (rowText || "").match(/Item total \(MRP\).*?₹\s*([0-9.,]+)/i);
  const actualCartSubtotal = match ? parseFloat(match[1].replace(/,/g, "")) : 0;

  console.log(`Actual UI Subtotal: ₹${actualCartSubtotal}`);

  // Assert Step 5: Subtotal matches sum of line items
  expect(actualCartSubtotal).toBeCloseTo(expectedMrpSubtotal, 1);

  // ==========================================
  // STEP 6: Full Price Breakup & Equation Reconciliation
  // ==========================================

  // Extract all bill summary row texts directly from the DOM to ensure 100% reliability
  const billSummaryRows = await page
    .locator(".flex.justifyBetween, div.flexColumn div.flex.justifyBetween")
    .allTextContents();
  const summaryTextCombined = billSummaryRows.join(" ");

  // 1. Extract Handling Charges dynamically
  const handlingMatch = summaryTextCombined.match(
    /Handling charges.*?₹\s*([0-9.,]+)/i,
  );
  const handlingCharges = handlingMatch
    ? parseFloat(handlingMatch[1].replace(/,/g, ""))
    : 0;

  // 2. Extract Total Discount dynamically (handles negative signs like -₹0.24)
  const discountMatch = summaryTextCombined.match(
    /Total discount.*?(-?₹\s*[0-9.,]+)/i,
  );
  let totalDiscount = 0;
  if (discountMatch) {
    const rawDiscStr = discountMatch[1].replace(/[^0-9.-]/g, "");
    totalDiscount = parseFloat(rawDiscStr) || 0;
    // Ensure discount is negative for the equation
    if (totalDiscount > 0 && discountMatch[1].includes("-")) {
      totalDiscount = -totalDiscount;
    }
  }

  const finalPayableUI = await cartPage.getFinalPayableAmount();

  console.log(
    `Price Breakup -> Item Total: ₹${actualCartSubtotal}, Discount: ₹${totalDiscount}, Charges: ₹${handlingCharges}, Final Payable UI: ₹${finalPayableUI}`,
  );

  // Reconcile equation: item total + discount (negative) + charges = payable
  const expectedPayable = actualCartSubtotal + totalDiscount + handlingCharges;

  console.log(`Reconciled Expected Payable: ₹${expectedPayable}`);

  // Assert Step 6: Final payable amount matches equation
  expect(finalPayableUI).toBeCloseTo(expectedPayable, 2);
});
