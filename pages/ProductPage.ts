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
      const mainBuyBox = this.page.locator(".col-8.flexColumn").first();
      const mainAddButton = mainBuyBox
        .getByRole("button", { name: /^ADD$/i })
        .first();

      if (await mainAddButton.isVisible()) {
        await this.safeClick(mainAddButton);
      }

      // Verify the quantity selector button has appeared in the main buy box
      const activeQtyBtn = mainBuyBox
        .locator('[class*="QtySelectedButton"]')
        .first();
      await expect(activeQtyBtn).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 15000 });
  }

  async getActiveQuantityLocator(): Promise<Locator> {
    const mainBuyBox = this.page.locator(".col-8.flexColumn").first();
    const activeQtyBtn = mainBuyBox
      .locator(
        '[class*="QtySelectedButton"], button:has(img[alt*="chevron" i])',
      )
      .first();

    await expect(activeQtyBtn).toBeVisible({ timeout: 8000 });
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
}
