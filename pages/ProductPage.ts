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
    await this.page.waitForTimeout(2000); // Give JS a moment to hydrate

    await expect(async () => {
      // 1. Is the success state ALREADY visible? (from a previous retry loop)
      const activeQtyBtn = this.page
        .locator('[class*="QtySelectedButton"]')
        .first();
      if (await activeQtyBtn.isVisible()) {
        return; // Success! Exit the retry block immediately.
      }

      // 2. If not, find the ADD button and click it
      let clicked = false;
      for (let i = 0; i < (await this.addButtons.count()); i++) {
        if (await this.addButtons.nth(i).isVisible()) {
          await this.safeClick(this.addButtons.nth(i));
          clicked = true;
          break;
        }
      }

      // If we couldn't find the Qty button AND we couldn't find the ADD button, fail the attempt
      expect(clicked).toBeTruthy();

      // 3. Verify the button appeared (If this fails, .toPass will safely retry step 1)
      await expect(activeQtyBtn).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 10000 });
  }

  async validateQuantityState(quantity: number): Promise<Locator> {
    // Locate the active quantity button using the exact class from your HTML
    const activeQtyBtn = this.page
      .locator('[class*="QtySelectedButton"]')
      .first();

    // Instead of exact text matching, we just check that the button CONTAINS the target number.
    // This perfectly handles "1", "3", "1 Added", or "3 Added" automatically!
    await expect(activeQtyBtn).toContainText(quantity.toString(), {
      timeout: 8000,
    });

    return activeQtyBtn;
  }

  async changeQuantity(currentQtyLocator: Locator, newQuantity: number) {
    await this.safeClick(currentQtyLocator);

    const quantityModal = this.page
      .getByRole("dialog", { name: /Select Quantity/i })
      .first();

    await quantityModal.waitFor({ state: "visible", timeout: 5000 });

    const option = quantityModal
      .getByText(newQuantity.toString(), { exact: true })
      .first();

    await this.safeClick(option);
    await this.page.waitForTimeout(1000);
  }

  async goToCart() {
    await this.cartIcon.waitFor({ state: "visible" });
    await this.safeClick(this.cartIcon);
    await this.page.waitForLoadState("domcontentloaded");
  }
}
