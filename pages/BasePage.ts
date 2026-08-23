import { Locator, Page } from "@playwright/test";

export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // The shared overlay handler used across all pages
  async dismissOverlay() {
    await this.dismissVisibleOverlay();
  }

  // Fallback for when scrolling triggers the overlay again before a click
  async dismissVisibleOverlay() {
    // 1. Substitute Savings Modal fallback ("Not now" button)
    const notNowBtn = this.page
      .getByRole("button", { name: /not now/i })
      .first();
    try {
      if (await notNowBtn.isVisible()) {
        await notNowBtn.click();
        await notNowBtn
          .waitFor({ state: "hidden", timeout: 3000 })
          .catch(() => {});
      }
    } catch (error) {}

    // 2. New promo dialog & image-based cross fallback
    const crossBtn = this.page
      .locator(
        'button[aria-label="cross"], button[aria-label="Close"], button:has(img[alt*="cross" i])',
      )
      .first();
    try {
      if (await crossBtn.isVisible()) {
        await crossBtn.click();
        await crossBtn
          .waitFor({ state: "hidden", timeout: 3000 })
          .catch(() => {});
      }
    } catch (error) {}

    // 3. Old overlay fallback
    const powerCloseBtn = this.page.locator(".bg_power_close").first();
    try {
      if (await powerCloseBtn.isVisible()) {
        await powerCloseBtn.click();
        await powerCloseBtn
          .waitFor({ state: "hidden", timeout: 3000 })
          .catch(() => {});
      }
    } catch (error) {}

    // 4. Generic 1mg modal overlay interceptor cleanup
    const genericOverlayClose = this.page
      .locator(
        '.Dialog__vsatOverlay__gJS_t button[aria-label="cross"], .Dialog__vsatOverlay__gJS_t button',
      )
      .first();
    try {
      if (await genericOverlayClose.isVisible()) {
        await genericOverlayClose.click();
        await genericOverlayClose
          .waitFor({ state: "hidden", timeout: 3000 })
          .catch(() => {});
      }
    } catch (error) {}

    // FIX: 5. 3rd-Party Iframe Ads (Google/DoubleClick) Fallback
    // If a massive ad iframe is hijacking the view, pressing Escape is usually the most
    // reliable way to dismiss it without having to traverse the iframe's internal DOM.
    try {
      const adIframe = this.page
        .locator('iframe[src*="doubleclick.net"]')
        .first();
      if (await adIframe.isVisible()) {
        await this.page.keyboard.press("Escape");
        await adIframe
          .waitFor({ state: "hidden", timeout: 2000 })
          .catch(() => {});
      }
    } catch (error) {}
  }

  /**
   * Safely clicks an element by ensuring it is in view,
   * clearing any known overlays, and handling late-loading asynchronous ads.
   */
  /**
   * Safely clicks an element by ensuring it is in view,
   * clearing any known overlays, and handling late-loading asynchronous ads.
   */
  async safeClick(locator: Locator) {
    if (!locator) {
      throw new Error("safeClick was called with an undefined locator.");
    }

    try {
      await locator.waitFor({ state: "visible", timeout: 5000 });
      await locator.scrollIntoViewIfNeeded();
      await this.page.evaluate(() => window.scrollBy(0, -100));
    } catch (e) {
      await this.dismissVisibleOverlay();
    }

    // Dismiss any overlays that might be covering the element
    await this.dismissVisibleOverlay();

    // Standard Playwright click - resilient and compliant
    try {
      await locator.click({ timeout: 5000 });
    } catch (clickError) {
      await this.dismissVisibleOverlay();
      // FIX: Added timeout: 5000 here so it fails fast instead of hanging for 3 minutes!
      await locator.click({ force: true, timeout: 5000 });
    }
  }
}
