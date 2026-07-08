import { Page } from "@playwright/test";

export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // The shared overlay handler used across all pages
  async dismissOverlay() {
    const screenOverlay = this.page.locator(".bg_power_overlay.show");
    try {
      await screenOverlay.waitFor({ state: "visible", timeout: 3000 });
      await this.page
        .locator('.bg_power_close, [aria-label="Close"]')
        .first()
        .click();
      await screenOverlay.waitFor({ state: "hidden", timeout: 3000 });
    } catch (error) {
      // Silently continue if it doesn't appear
    }
  }

  // Fallback for when scrolling triggers the overlay again
  async dismissVisibleOverlay() {
    const screenOverlay = this.page.locator(".bg_power_overlay.show");
    if (await screenOverlay.isVisible()) {
      await this.page
        .locator('.bg_power_close, [aria-label="Close"]')
        .first()
        .click();
      await screenOverlay.waitFor({ state: "hidden", timeout: 3000 });
    }
  }
}
