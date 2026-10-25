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
  // Click a dismiss button only if it is showing. Every click is bounded: Playwright's
  // default click timeout is unlimited, so an un-clickable button used to hang the
  // whole test until its 180s timeout.
  private async dismissIfVisible(locator: Locator) {
    try {
      if (await locator.isVisible()) {
        await locator.click({ timeout: 2000 });
        await locator
          .waitFor({ state: "hidden", timeout: 3000 })
          .catch(() => {});
      }
    } catch {
      // Not clickable right now: ignore it and carry on
    }
  }

  async dismissVisibleOverlay() {
    const p = this.page;

    await this.dismissIfVisible(
      p.getByRole("button", { name: /not now/i }).first(),
    );
    await this.dismissIfVisible(
      p
        .locator(
          'button[aria-label="cross"], button[aria-label="Close"], button:has(img[alt*="cross" i])',
        )
        .first(),
    );
    await this.dismissIfVisible(p.locator(".bg_power_close").first());
    // Partial class match, so a changed hash suffix doesn't break it
    await this.dismissIfVisible(
      p.locator('[class*="Dialog__vsatOverlay"] button').first(),
    );

    // 3rd-party ad iframe: Escape is the most reliable way to dismiss it
    try {
      const adIframe = p.locator('iframe[src*="doubleclick.net"]').first();
      if (await adIframe.isVisible()) {
        await p.keyboard.press("Escape");
        await adIframe
          .waitFor({ state: "hidden", timeout: 2000 })
          .catch(() => {});
      }
    } catch {}
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
