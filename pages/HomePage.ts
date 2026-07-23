import { Locator, Page } from "@playwright/test";
import { BasePage } from "./BasePage";

export class HomePage extends BasePage {
  // Hero Carousel Locators
  readonly playPauseButton: Locator;
  readonly pauseIcon: Locator;
  readonly playIcon: Locator;

  // Deals Carousel Locators
  readonly dealsSectionTitle: Locator;
  readonly dealsSectionContainer: Locator;

  constructor(page: Page) {
    super(page);

    // Hero Carousel
    this.playPauseButton = page
      .locator("button")
      .filter({ has: page.locator('img[alt="Play"], img[alt="Pause"]') })
      .first();
    this.pauseIcon = this.playPauseButton.locator('img[alt="Pause"]');
    this.playIcon = this.playPauseButton.locator('img[alt="Play"]');

    // Deals Section
    this.dealsSectionTitle = page
      .getByRole("heading", { name: /super saving deals/i })
      .first();

    // REFACTORED: Using .last() grabs the shared "flexColumn" parent div that contains
    // BOTH the title sibling and the carousel sibling (from the screenshot DOM).
    this.dealsSectionContainer = page
      .locator("div")
      .filter({ has: this.dealsSectionTitle })
      .filter({ has: page.locator('[class*="Carousel__slide"]') })
      .last();
  }

  async navigate() {
    await this.page.goto("/", { waitUntil: "load" });
    await this.dismissOverlay();
  }

  // --- HERO CAROUSEL METHODS ---
  async getActiveSlideLabel(): Promise<string> {
    const activeDot = this.page
      .locator(
        '[aria-label*="slide" i][aria-selected="true"], [aria-label*="slide" i][class*="active"]',
      )
      .first();

    await activeDot.waitFor({ state: "attached", timeout: 5000 });
    const label = await activeDot.getAttribute("aria-label");
    if (!label) throw new Error("Could not find aria-label on the active dot!");
    return label;
  }

  async togglePlayPause() {
    await this.safeClick(this.playPauseButton);
  }

  async waitForSlideTransition(ms: number = 6500) {
    await this.page.waitForTimeout(ms);
  }

  // --- DEALS CAROUSEL METHODS ---
  async scrollToDealsSection() {
    await this.dealsSectionTitle.scrollIntoViewIfNeeded();
    await this.page.mouse.wheel(0, 500);
    await this.dismissVisibleOverlay();
  }

  async openDealProductFromEnd(offset: number): Promise<string> {
    await this.page
      .getByText("₹")
      .first()
      .waitFor({ state: "visible", timeout: 10000 });

    // Precise: Targeting the exact Slide class from the DOM screenshot instead of heavy generic "a" tags
    const productCards = this.dealsSectionContainer.locator(
      '[class*="Carousel__slide"]',
    );
    await productCards.first().waitFor({ state: "attached", timeout: 5000 });

    const totalItems = await productCards.count();

    // REQUIREMENT MET: nth(totalItems - 2) picks the item BEFORE the last item
    const targetCard = productCards.nth(totalItems - offset);

    // Standard Next Arrow
    const nextArrow = this.dealsSectionContainer
      .locator(
        '[aria-label="Next"], .slick-next, [class*="right" i][class*="arrow" i]',
      )
      .first();

    // Scroll carousel until target is visible (max 15 attempts)
    const MAX_SCROLL_ATTEMPTS = 15;

    for (let attempt = 0; attempt < MAX_SCROLL_ATTEMPTS; attempt++) {
      if (await targetCard.isVisible()) {
        break;
      }

      await this.dealsSectionContainer.hover();

      if (!(await nextArrow.isVisible())) {
        break;
      }

      // Standard click is used here to avoid scrolling the whole window while navigating the carousel
      await nextArrow.click();
      await this.page.waitForTimeout(600);
    }

    if (!(await targetCard.isVisible())) {
      throw new Error(
        `Target product was not visible after ${MAX_SCROLL_ATTEMPTS} carousel scroll attempts.`,
      );
    }

    const productText = await targetCard.innerText();
    const cardTitleSnippet = productText
      .split("\n")[0]
      .trim()
      .replace("...", "");

    // REFACTORED: Utilized safeClick for consistency across the framework
    await this.safeClick(targetCard);

    // Wait for the new page to fully load before returning
    await this.page.waitForLoadState("domcontentloaded");

    return cardTitleSnippet;
  }
}
