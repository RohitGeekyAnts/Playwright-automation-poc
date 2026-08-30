import { Locator, Page, expect } from "@playwright/test";
import { BasePage } from "./BasePage";

export class CartPage extends BasePage {
  readonly checkoutBtn: Locator;
  readonly loginModal: Locator;

  constructor(page: Page) {
    super(page);

    this.checkoutBtn = page
      .locator('a[href*="/checkout"], button')
      .filter({ hasText: /checkout|continue/i })
      .last();

    this.loginModal = page
      .getByRole("dialog")
      .filter({ hasText: "Login" })
      .first();
  }

  async validateItemExists(itemSnippet: string) {
    const cartItemTitle = this.page
      .getByText(itemSnippet, { exact: false })
      .first();
    await expect(cartItemTitle).toBeVisible({ timeout: 5000 });
  }

  async proceedToCheckout() {
    await this.checkoutBtn.waitFor({ state: "visible", timeout: 5000 });
    await this.safeClick(this.checkoutBtn);
  }

  async validateLoginModalVisible() {
    await expect(this.loginModal).toBeVisible({ timeout: 5000 });
  }

  // --- NEW FLOW 2 METHODS ---

  async getItemTotal(itemName: string): Promise<number> {
    const cartItemLink = this.page
      .locator("a")
      .filter({ hasText: itemName })
      .first();
    await cartItemLink.waitFor({ state: "visible" });
    const fullText = await cartItemLink.innerText();

    const match = fullText.match(/₹\s*([0-9.,]+)/);
    if (match) {
      const numericValue = parseFloat(match[1].replace(/,/g, ""));
      return isNaN(numericValue) ? 0 : numericValue;
    }

    return 0;
  }

  async getFinalPayableAmount(): Promise<number> {
    const toPayLabel = this.page.getByText("To be paid").last();
    await toPayLabel.waitFor({ state: "visible" });

    const totalText = await toPayLabel.locator("..").innerText();

    const numericValue = parseFloat(totalText.replace(/[^0-9.]/g, ""));
    return isNaN(numericValue) ? 0 : numericValue;
  }

  async reduceQuantityToOne(itemName: string) {
    const cartItemLink = this.page
      .locator("a")
      .filter({ hasText: itemName })
      .first();

    const reduceBtn = cartItemLink
      .locator("button")
      .filter({
        has: this.page.locator(
          'img[alt="reduce quantity"], img[alt="delete item"]',
        ),
      })
      .first();

    const currentTotal = await this.getFinalPayableAmount();

    await this.safeClick(reduceBtn);

    await expect(async () => {
      const newTotal = await this.getFinalPayableAmount();
      expect(newTotal).toBeLessThan(currentTotal);
    }).toPass({ timeout: 10000 });
  }

  async removeItem(itemName: string) {
    const cartItemLink = this.page
      .locator("a")
      .filter({ hasText: itemName })
      .first();

    const deleteBtn = cartItemLink
      .locator("button")
      .filter({
        has: this.page.locator('img[alt*="delete" i]'),
      })
      .first();

    await this.safeClick(deleteBtn);

    const confirmRemoveBtn = this.page
      .getByRole("dialog")
      .getByRole("button", { name: /remove|delete|yes/i })
      .first();

    try {
      await confirmRemoveBtn.waitFor({ state: "visible", timeout: 3000 });
      await this.safeClick(confirmRemoveBtn);
    } catch (e) {
      // Continue safely if no confirmation prompt appears
    }

    await cartItemLink.waitFor({ state: "hidden", timeout: 10000 });
  }

  async validateEmptyCart() {
    const emptyMsg = this.page
      .getByText(/Your cart is empty|0 items?|no items?/i)
      .first();

    await expect(emptyMsg).toBeVisible({ timeout: 10000 });
  }

  async getHandlingCharges(): Promise<number> {
    const label = this.page.getByText("Handling charges").last();
    await label.waitFor({ state: "visible" });
    const text = await label.locator("..").locator("..").innerText();
    const match = text.match(/₹\s*([0-9.,]+)/);
    return match ? parseFloat(match[1].replace(/,/g, "")) : 0;
  }

  // --- STEP 7 & 8 COUPON METHODS ---

  async applyCoupon(couponCodeOrIndex: string | number = 0) {
    const applyCouponBtn = this.page.getByText("Apply coupon").first();
    await applyCouponBtn.waitFor({ state: "visible" });
    await this.safeClick(applyCouponBtn);

    const couponModal = this.page.getByRole("dialog").first();
    await couponModal.waitFor({ state: "visible", timeout: 5000 });

    // FIX 1: Clean, foolproof locator using the "marginTop-16" wrapper around every coupon
    if (typeof couponCodeOrIndex === "string") {
      const couponCard = couponModal
        .locator("div.marginTop-16")
        .filter({ hasText: couponCodeOrIndex })
        .first();
      await this.safeClick(
        couponCard.getByRole("button", { name: /^apply$/i }).first(),
      );
    } else {
      const couponCard = couponModal
        .locator("div.marginTop-16")
        .nth(couponCodeOrIndex);
      await this.safeClick(
        couponCard.getByRole("button", { name: /^apply$/i }).first(),
      );
    }

    // FIX 2: Close modal securely
    const closeBtn = couponModal
      .locator('button[aria-label="cross"], button[aria-label*="close"]')
      .first();
    if (await closeBtn.isVisible()) {
      await this.safeClick(closeBtn);
    } else {
      await this.page.keyboard.press("Escape");
    }
    await couponModal.waitFor({ state: "hidden", timeout: 5000 });

    // FIX 3: Wait specifically for the success text to appear on the cart page BEFORE reading the discount
    const appliedTag = this.page.getByText(/applied\s*\|\s*saved/i).first();
    await appliedTag.waitFor({ state: "visible", timeout: 15000 });
  }

  async getTotalDiscount(): Promise<number> {
    const label = this.page.getByText("Total discount").last();
    await label.waitFor({ state: "visible", timeout: 10000 });

    // FIX 4: Safely extract the discount value regardless of DOM parent nesting
    const allSummaryText = await this.page
      .locator(".flex.justifyBetween, div.flexColumn")
      .allTextContents();
    const combinedText = allSummaryText.join(" ");

    const match = combinedText.match(/Total discount.*?(-?₹\s*[0-9.,]+)/i);
    if (match) {
      const value = parseFloat(match[1].replace(/[^0-9.]/g, ""));
      return match[1].includes("-") ? -value : value;
    }

    return 0;
  }

  async removeCoupon() {
    // 1. Target the applied section using the text rendered in the DOM
    const appliedSection = this.page
      .locator("div")
      .filter({ hasText: /applied\s*\|\s*saved/i })
      .first();

    await appliedSection.waitFor({ state: "visible", timeout: 5000 });

    // 2. Click the cross image using a broader, more resilient locator
    const removeIcon = appliedSection
      .locator('img[alt*="cross" i], img[src*="cross"]')
      .first();
    await this.safeClick(removeIcon);

    // 3. Wait for the "Apply coupon" button to reappear, which definitively proves the coupon was cleared
    const applyCouponBtn = this.page.getByText("Apply coupon").first();
    await applyCouponBtn.waitFor({ state: "visible", timeout: 15000 });

    // 4. Add a tiny stabilization delay for the React component to finish calculating the new "Total discount" text
    await this.page.waitForTimeout(1000);
  }
}
