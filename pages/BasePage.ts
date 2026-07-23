import { Locator, Page } from "@playwright/test";

export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // The shared overlay handler used across all pages
  async dismissOverlay() {
    // 1. Check directly for the original power overlay close button
    const powerCloseBtn = this.page
      .locator('.bg_power_close, button[aria-label="Close"]')
      .first();
    try {
      if (await powerCloseBtn.isVisible()) {
        await powerCloseBtn.click();
      }
    } catch (error) {
      // Silently continue if it doesn't appear
    }

    // 2. Check directly for the Promo Dialog close button
    const promoCloseBtn = this.page
      .locator('button[aria-label="cross"]')
      .first();
    try {
      if (await promoCloseBtn.isVisible()) {
        await promoCloseBtn.click();
      }
    } catch (error) {}
  }

  // Fallback for when scrolling triggers the overlay again before a click
  async dismissVisibleOverlay() {
    // 1. Old overlay fallback
    const powerCloseBtn = this.page
      .locator('.bg_power_close, button[aria-label="Close"]')
      .first();
    if (await powerCloseBtn.isVisible()) {
      await powerCloseBtn.click();
    }

    // 2. New promo dialog fallback
    const promoCloseBtn = this.page
      .locator('button[aria-label="cross"]')
      .first();
    if (await promoCloseBtn.isVisible()) {
      await promoCloseBtn.click();
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
