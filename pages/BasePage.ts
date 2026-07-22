import { Locator, Page } from "@playwright/test";

export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // The shared overlay handler used across all pages
  async dismissOverlay() {
    // 1. Check for the original power overlay
    const powerOverlay = this.page.locator(".bg_power_overlay.show");
    try {
      if (await powerOverlay.isVisible()) {
        await this.page
          .locator('.bg_power_close, [aria-label="Close"]')
          .first()
          .click();
        await powerOverlay.waitFor({ state: "hidden", timeout: 3000 });
      }
    } catch (error) {
      // Silently continue if it doesn't appear
    }

    // 2. Check for the Evening Sample Collection promo dialog
    // Using .first() to prevent strict mode violations if multiple containers exist
    const promoDialog = this.page
      .locator('[class*="Dialog__vsatContainer"]')
      .first();
    try {
      if (await promoDialog.isVisible()) {
        await this.page.locator('button[aria-label="cross"]').first().click();
        await promoDialog.waitFor({ state: "hidden", timeout: 3000 });
      }
    } catch (error) {
      // Silently continue if it doesn't appear
    }
  }

  // Fallback for when scrolling triggers the overlay again before a click
  async dismissVisibleOverlay() {
    // 1. Old overlay fallback
    const powerOverlay = this.page.locator(".bg_power_overlay.show");
    if (await powerOverlay.isVisible()) {
      await this.page
        .locator('.bg_power_close, [aria-label="Close"]')
        .first()
        .click();
      await powerOverlay.waitFor({ state: "hidden", timeout: 3000 });
    }

    // 2. New promo dialog fallback
    const promoDialog = this.page
      .locator('[class*="Dialog__vsatContainer"]')
      .first();
    if (await promoDialog.isVisible()) {
      await this.page.locator('button[aria-label="cross"]').first().click();
      await promoDialog.waitFor({ state: "hidden", timeout: 3000 });
    }
  }

  /**
   * Safely clicks an element by ensuring it is in view,
   * clearing any known overlays, and performing a standard actionability check.
   */
  async safeClick(locator: Locator) {
    // 1. Ensure the element is in the viewport
    await locator.scrollIntoViewIfNeeded();

    // 2. Clear any overlays (power overlay or promo dialogs) that might be blocking the click
    await this.dismissVisibleOverlay();

    // 3. Perform a standard click without { force: true }
    await locator.click();
  }
}
