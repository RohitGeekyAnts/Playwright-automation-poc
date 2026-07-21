import { Locator, Page, expect } from "@playwright/test";
import { BasePage } from "./BasePage";

export class ProductPage extends BasePage {
  readonly titleElement: Locator;
  readonly addButtons: Locator;
  readonly cartIcon: Locator;

  constructor(page: Page) {
    super(page);
    this.titleElement = page.locator("h1").first();
    this.addButtons = page.getByText("ADD", { exact: true });
    this.cartIcon = page.locator('a[href="/cart"]').first();
  }

  async getProductTitle(): Promise<string> {
    await this.titleElement.waitFor({ state: "visible", timeout: 5000 });
    return await this.titleElement.innerText();
  }

  async clickAddButton() {
    await this.page.waitForTimeout(2000);
    await expect(async () => {
      let clicked = false;
      for (let i = 0; i < (await this.addButtons.count()); i++) {
        if (await this.addButtons.nth(i).isVisible()) {
          await this.addButtons.nth(i).click();
          clicked = true;
          break;
        }
      }
      expect(clicked).toBeTruthy();
    }).toPass({ timeout: 5000 });
  }

  async validateQuantityState(quantity: number): Promise<Locator> {
    const qtyElements = this.page.getByText(
      new RegExp(`${quantity}\\s*Added`, "i"),
    );
    let activeLocator = qtyElements.first();

    await expect(async () => {
      let found = false;
      for (let i = 0; i < (await qtyElements.count()); i++) {
        if (await qtyElements.nth(i).isVisible()) {
          activeLocator = qtyElements.nth(i);
          found = true;
          break;
        }
      }
      expect(found).toBeTruthy();
    }).toPass({ timeout: 8000 });

    return activeLocator;
  }

  async changeQuantity(currentQtyLocator: Locator, newQuantity: number) {
    await currentQtyLocator.click();
    const quantityModal = this.page
      .locator("div")
      .filter({ has: this.page.getByText("Select Quantity") })
      .filter({ has: this.page.getByText("Remove") })
      .last();

    const option = quantityModal
      .getByText(newQuantity.toString(), { exact: true })
      .first();
    await option.click();
    await this.page.waitForTimeout(1000);
  }

  async goToCart() {
    // Ensure the cart icon is visible and attached to the DOM
    await this.cartIcon.waitFor({ state: "visible" });

    // Standard click with Playwright's native actionability checks
    await this.cartIcon.click();
    await this.page.waitForLoadState("domcontentloaded");
  }
}
