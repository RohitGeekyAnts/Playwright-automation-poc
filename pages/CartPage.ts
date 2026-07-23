import { Locator, Page, expect } from "@playwright/test";
import { BasePage } from "./BasePage";

export class CartPage extends BasePage {
  readonly checkoutBtn: Locator;
  readonly loginModal: Locator;

  constructor(page: Page) {
    super(page);

    // REFACTORED: Directly targets interactive elements, removing the wide 'div' fallback and complex .or() chain
    this.checkoutBtn = page
      .locator('a[href*="/checkout"], button')
      .filter({ hasText: /checkout|continue/i })
      .last();

    // REFACTORED: Using a stable, semantic locator for the modal popup
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

    // REFACTORED: Replaced native click with safeClick
    await this.safeClick(this.checkoutBtn);
  }

  async validateLoginModalVisible() {
    await expect(this.loginModal).toBeVisible({ timeout: 5000 });
  }
}
