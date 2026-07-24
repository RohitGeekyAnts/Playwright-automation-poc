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
    // 3. Generic 1mg modal overlay interceptor cleanup
    const genericOverlayClose = this.page
      .locator(
        '.Dialog__vsatOverlay__gJS_t button[aria-label="cross"], .Dialog__vsatOverlay__gJS_t button',
      )
      .first();
    if (await genericOverlayClose.isVisible()) {
      await genericOverlayClose.click();
    }
  }

  /**
   * Safely clicks an element by ensuring it is in view,
   * clearing any known overlays, and handling late-loading asynchronous ads.
   */
  async safeClick(locator: Locator) {
    // 1. Ensure the element is in the viewport (This often triggers lazy-loaded ads)
    await locator.scrollIntoViewIfNeeded();

    // 2. Clear any overlays that are immediately visible
    await this.dismissVisibleOverlay();

    try {
      // 3. Attempt the click with a short timeout (3 seconds).
      // If a lazy-loaded ad pops up and intercepts it, this will quickly fail instead of hanging for 30s.
      await locator.click({ timeout: 3000 });
    } catch (error: any) {
      // 4. If intercepted, it means an ad appeared AFTER our first dismissal attempt
      if (
        error.message.includes("intercepts pointer events") ||
        error.message.includes("Timeout")
      ) {
        // The ad is now fully rendered in the DOM, so dismiss it!
        await this.dismissVisibleOverlay();

        // Final attempt with the standard default timeout
        await locator.click();
      } else {
        // Re-throw if the click failed for a completely different reason (e.g., element detached)
        throw error;
      }
    }
  }
}
