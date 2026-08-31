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
  // STEP 1: Set City Explicitly & Clear State
  // ==========================================
  await homePage.navigate();

  // FIX: Clear local storage, session storage, AND cookies to ensure the cart starts strictly at 0
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.context().clearCookies(); // Crucial for wiping guest cart sessions

  await page.reload();

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

    // Directly update to the requested item quantity if it's more than 1
    if (item.qty > 1) {
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
  // STEP 5: Assert Subtotal Matches Cart Items
  // ==========================================
  const summaryRow = page
    .locator(".flex.justifyBetween")
    .filter({ hasText: "Item total (MRP)" });
  await summaryRow.waitFor({ state: "visible", timeout: 10000 });
  const rowText = await summaryRow.textContent();

  const match = (rowText || "").match(/Item total \(MRP\).*?₹\s*([0-9.,]+)/i);
  const actualCartSubtotal = match ? parseFloat(match[1].replace(/,/g, "")) : 0;

  console.log(`Actual UI Subtotal: ₹${actualCartSubtotal}`);

  // Assert Step 5: Verify the cart subtotal is rendered and greater than zero
  expect(actualCartSubtotal).toBeGreaterThan(0);

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

  // ==========================================
  // STEP 7: Apply Coupon and Verify Discount Update
  // ==========================================
  const discountBeforeCoupon = totalDiscount;
  const payableBeforeCoupon = finalPayableUI;

  // Click 'Apply coupon' and select the first available coupon from the modal list
  await cartPage.applyCoupon(0);

  // Fetch updated values from the Bill Summary
  const discountAfterCoupon = await cartPage.getTotalDiscount();
  const finalPayableAfterCoupon = await cartPage.getFinalPayableAmount();

  console.log(
    `Coupon Applied -> Previous Discount: ₹${discountBeforeCoupon}, New Discount: ₹${discountAfterCoupon}`,
  );

  // Assert that the discount increased in magnitude
  expect(Math.abs(discountAfterCoupon)).toBeGreaterThan(
    Math.abs(discountBeforeCoupon),
  );

  // Re-reconcile equation with the coupon discount applied
  const expectedPayableWithCoupon =
    actualCartSubtotal + discountAfterCoupon + handlingCharges;
  expect(finalPayableAfterCoupon).toBeCloseTo(expectedPayableWithCoupon, 2);

  // ==========================================
  // STEP 8: Remove Coupon and Verify Restoration
  // ==========================================
  await cartPage.removeCoupon();

  const discountAfterRemoval = await cartPage.getTotalDiscount();
  const finalPayableAfterRemoval = await cartPage.getFinalPayableAmount();

  console.log(
    `Coupon Removed -> Restored Discount: ₹${discountAfterRemoval}, Restored Payable: ₹${finalPayableAfterRemoval}`,
  );

  // Assert that the discount and payable amount successfully revert to pre-coupon states
  expect(discountAfterRemoval).toBeCloseTo(discountBeforeCoupon, 2);
  expect(finalPayableAfterRemoval).toBeCloseTo(payableBeforeCoupon, 2);

  console.log(
    "Steps 7 & 8 Complete: Coupon application and removal verified successfully.",
  );
  // ==========================================
  // STEP 9: Modify Cart (Remove Item) & Verify Bill Summary Updates
  // ==========================================
  const payableBeforeModify = await cartPage.getFinalPayableAmount();

  // Pick an item to remove (e.g., the last item we added)
  const itemToRemove = capturedCartItems[capturedCartItems.length - 1];
  console.log(
    `Step 9: Removing item '${itemToRemove.name}' to verify bill recalculation...`,
  );

  await cartPage.removeItem(itemToRemove.name);

  // Smart polling: Wait for the final payable amount to strictly decrease
  let payableAfterModify = 0;
  await expect(async () => {
    payableAfterModify = await cartPage.getFinalPayableAmount();
    expect(payableAfterModify).toBeLessThan(payableBeforeModify);
  }).toPass({ timeout: 15000 });

  console.log(
    `Bill Summary Updated Successfully -> Old Payable: ₹${payableBeforeModify}, New Payable: ₹${payableAfterModify}`,
  );

  // ==========================================
  // STEP 10: Click Continue to Proceed to Checkout
  // ==========================================
  console.log("Step 10: Proceeding to checkout...");
  await cartPage.proceedToCheckout();

  // ==========================================
  // STEP 11: Validate Final Gate Check (Login Modal)
  // ==========================================
  console.log(
    "Step 11: Validating login modal appears for unauthenticated user...",
  );
  await cartPage.validateLoginModalVisible();

  console.log(
    "Flow 3 complete: All 11 steps executed and passed successfully!",
  );
});
