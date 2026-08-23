import { Locator, Page, expect } from "@playwright/test";
import { BasePage } from "./BasePage";

export class ProductPage extends BasePage {
  readonly titleElement: Locator;
  readonly cartIcon: Locator;

  constructor(page: Page) {
    super(page);
    this.titleElement = page.locator("h1").first();
    this.cartIcon = page.locator('a[href="/cart"]').first();
  }

  async getProductTitle(): Promise<string> {
    await this.titleElement.waitFor({ state: "visible", timeout: 5000 });
    return await this.titleElement.innerText();
  }

  async clickAddButton() {
    await expect(async () => {
      let mainBuyBox = this.page.locator(".col-8.flexColumn").first();
      if ((await mainBuyBox.count()) === 0) {
        mainBuyBox = this.page.locator("main").first();
      }

      const mainAddButton = mainBuyBox
        .getByRole("button", { name: /^add$|^add to cart$/i })
        .first();

      const activeQtyBtn = mainBuyBox
        .locator(
          '[class*="QtySelectedButton"], button:has(img[alt*="chevron" i])',
        )
        .first();

      // Only attempt to click ADD if the item isn't already in the "Added" state
      if ((await activeQtyBtn.count()) === 0) {
        if ((await mainAddButton.count()) > 0) {
          await this.safeClick(mainAddButton);

          // FIX: Handle the Substitute Savings modal by clicking the top-right 'X' instead of 'Not now'
          const closePopupBtn = this.page
            .getByRole("button", { name: /cross/i })
            .first();

          try {
            await closePopupBtn.waitFor({ state: "visible", timeout: 3000 });
            await closePopupBtn.click(); // Standard, stable click!
            await closePopupBtn.waitFor({ state: "hidden", timeout: 3000 });
          } catch (e) {
            // Modal did not appear or closed instantly, safely ignore
          }
        }
      }

      // Verify it successfully transitioned to the Added state
      await expect(activeQtyBtn).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 15000 });
  }

  async getActiveQuantityLocator(): Promise<Locator> {
    let mainBuyBox = this.page.locator(".col-8.flexColumn").first();
    if ((await mainBuyBox.count()) === 0) {
      mainBuyBox = this.page.locator("main").first();
    }

    const activeQtyBtn = mainBuyBox
      .locator('button:has(img[alt*="chevron" i])')
      .first();
    return activeQtyBtn;
  }

  async validateQuantityState(expectedQuantity: number): Promise<Locator> {
    const activeLocator = await this.getActiveQuantityLocator();
    await expect(activeLocator).toContainText(expectedQuantity.toString(), {
      timeout: 5000,
    });
    return activeLocator;
  }

  async changeQuantity(currentQtyLocator: Locator, newQuantity: number) {
    const chevronIcon = currentQtyLocator
      .locator('img[alt*="chevron" i]')
      .first();

    if (await chevronIcon.isVisible()) {
      await this.safeClick(chevronIcon);
    } else {
      await this.safeClick(currentQtyLocator);
    }

    const quantityModal = this.page
      .locator('[class*="Dialog__vsatOverlay"], dialog, [role="dialog"]')
      .filter({ hasText: /Select Quantity/i })
      .first();

    await quantityModal.waitFor({ state: "visible", timeout: 5000 });

    const option = quantityModal
      .getByText(newQuantity.toString(), { exact: true })
      .first();

    await this.safeClick(option);

    // REFACTORED: Replaced 1000ms hard wait with a smart state check.
    // We instantly proceed the exact millisecond the modal disappears.
    await quantityModal.waitFor({ state: "hidden", timeout: 5000 });
  }

  async goToCart() {
    await this.cartIcon.waitFor({ state: "visible" });
    await this.safeClick(this.cartIcon);
    await this.page.waitForLoadState("domcontentloaded");
  }

  // --- NEW FLOW 2 METHODS ---

  async getFullProductDetails() {
    const name = await this.titleElement.innerText();
    const headerBlockText = await this.titleElement.locator("..").innerText();
    const packSizeMatch = headerBlockText.match(
      /(strip of|bottle of|box of|packet of|tube of|\d+\s+tablets?)[^\n]*/i,
    );
    const packSize = packSizeMatch
      ? packSizeMatch[0].replace(/Composition.*/i, "").trim()
      : "";

    // REFACTORED: Target the exact main buy box, completely ignoring substitute cards at the bottom
    const mainBuyBox = this.page.locator(".col-8.flexColumn").first();
    const priceBoxText = await mainBuyBox.innerText();

    // Clean the text stream: keep only lines with ₹, ignore "per ml/tablet" unit pricing
    const cleanPriceLines = priceBoxText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.includes("₹") && !l.toLowerCase().includes("per"));

    // The first valid price on a 1mg PDP is ALWAYS the Selling Price
    const sellingPrice = cleanPriceLines[0] || "";
    let mrp = sellingPrice;

    // If a second price exists and is higher, it represents the crossed-out MRP
    if (cleanPriceLines.length > 1) {
      const spVal = parseFloat(sellingPrice.replace(/[^0-9.]/g, ""));
      const secondVal = parseFloat(cleanPriceLines[1].replace(/[^0-9.]/g, ""));
      if (secondVal > spVal) {
        mrp = cleanPriceLines[1];
      }
    }

    // Find the standard discount, explicitly ignoring "Get Extra 4% off" Care Plan banners
    const discountLine = priceBoxText
      .split("\n")
      .find((l) => /\d+%\s*off/i.test(l) && !l.toLowerCase().includes("extra"));
    const discountMatch = discountLine
      ? discountLine.match(/\d+%\s*off/i)
      : null;

    return {
      name: name.trim(),
      packSize: packSize,
      sellingPrice: sellingPrice,
      mrp: mrp,
      discount: discountMatch ? discountMatch[0] : "",
    };
  }

  async getBreadcrumbText(): Promise<string> {
    // 1mg frequently updates CSS classes. We use a structural fallback.
    // Look for the exact "Home" link in the main container, which is the start of the breadcrumb trail.
    const homeLink = this.page
      .locator("main")
      .getByRole("link", { name: "Home", exact: true })
      .first();

    try {
      // Wait briefly to see if it attaches to DOM
      await homeLink.waitFor({ state: "visible", timeout: 3000 });

      // In the DOM structure, the "Home" link is inside a wrapper, and the actual breadcrumb row is the grandparent.
      const breadcrumbRow = homeLink.locator("..").locator("..");
      return await breadcrumbRow.innerText();
    } catch (error) {
      // If there is no breadcrumb (e.g., OTC items or variants), return an empty string safely
      return "";
    }
  }

  // In pages/ProductPage.ts
  async getDeliveryPromise(): Promise<string> {
    // Rely on the actual user-visible text prefix instead of unstable CSS classes
    const deliveryText = this.page.getByText(/Get by/i).first();

    try {
      await deliveryText.waitFor({ state: "visible", timeout: 5000 });
      return await deliveryText.innerText();
    } catch (error) {
      return "";
    }
  }
}
