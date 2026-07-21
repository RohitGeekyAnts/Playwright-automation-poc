import { Locator, Page, expect } from "@playwright/test";
import { BasePage } from "./BasePage";

export class CartPage extends BasePage {
  readonly checkoutBtn: Locator;
  readonly loginModal: Locator;

  constructor(page: Page) {
    super(page);
    this.checkoutBtn = page
      .locator('a[href*="/checkout"]')
      .or(
        page
          .locator("a, button, div")
          .filter({ hasText: /CHECKOUT|CONTINUE/i }),
      )
      .last();
    this.loginModal = page.getByText("Login", { exact: true }).first();
  }

  async validateItemExists(itemSnippet: string) {
    const cartItemTitle = this.page
      .getByText(itemSnippet, { exact: false })
      .first();
    await expect(cartItemTitle).toBeVisible({ timeout: 5000 });
  }

  async proceedToCheckout() {
    await this.checkoutBtn.waitFor({ state: "visible", timeout: 5000 });
    await this.checkoutBtn.click();
  }

  async validateLoginModalVisible() {
    await expect(this.loginModal).toBeVisible({ timeout: 5000 });
  }
}
