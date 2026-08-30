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

    // FIX: Match the first visible currency format (e.g., "₹85.66") directly
    const match = fullText.match(/₹\s*([0-9.,]+)/);
    if (match) {
      const numericValue = parseFloat(match[1].replace(/,/g, ""));
      return isNaN(numericValue) ? 0 : numericValue;
    }

    return 0;
  }

  async getFinalPayableAmount(): Promise<number> {
    // REFACTORED: Target the label, then read the parent's full text to capture the sibling price
    const toPayLabel = this.page.getByText("To be paid").last();
    await toPayLabel.waitFor({ state: "visible" });

    // Traverse up to the parent wrapper containing both the label and the price amount
    const totalText = await toPayLabel.locator("..").innerText();

    // Strip everything out of the text block except numbers and decimals
    const numericValue = parseFloat(totalText.replace(/[^0-9.]/g, ""));
    return isNaN(numericValue) ? 0 : numericValue;
  }

  // In pages/CartPage.ts
  async reduceQuantityToOne(itemName: string) {
    const cartItemLink = this.page
      .locator("a")
      .filter({ hasText: itemName })
      .first();

    // FIX: Look for either the minus icon OR the trash icon
    const reduceBtn = cartItemLink
      .locator("button")
      .filter({
        has: this.page.locator(
          'img[alt="reduce quantity"], img[alt="delete item"]',
        ),
      })
      .first();

    // Capture the total before we change the quantity
    const currentTotal = await this.getFinalPayableAmount();

    // Click the reduce button
    await this.safeClick(reduceBtn);

    // Smart polling: Wait for the total amount to mathematically recalculate before moving on!
    await expect(async () => {
      const newTotal = await this.getFinalPayableAmount();
      expect(newTotal).toBeLessThan(currentTotal);
    }).toPass({ timeout: 10000 });
  }

  // In pages/CartPage.ts
  async removeItem(itemName: string) {
    const cartItemLink = this.page
      .locator("a")
      .filter({ hasText: itemName })
      .first();

    const deleteBtn = cartItemLink
      .locator("button")
      .filter({
        // Stricter locator just for the delete icon
        has: this.page.locator('img[alt*="delete" i]'),
      })
      .first();

    await this.safeClick(deleteBtn);

    // FIX 1: Restrict confirmation search ONLY to dialog modals to prevent double-clicking
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

    // FIX 2: Explicitly wait for the item to fade out of the DOM
    await cartItemLink.waitFor({ state: "hidden", timeout: 10000 });
  }

  async validateEmptyCart() {
    // FIX 3: Use the exact phrase to prevent matching hidden script/meta tags
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

  async getTotalDiscount(): Promise<number> {
    const label = this.page.getByText("Total discount").last();
    await label.waitFor({ state: "visible" });
    const text = await label.locator("..").locator("..").innerText();
    const match = text.match(/-?₹\s*([0-9.,]+)/);
    const value = match ? parseFloat(match[1].replace(/,/g, "")) : 0;
    return text.includes("-") ? -value : value;
  }
}
