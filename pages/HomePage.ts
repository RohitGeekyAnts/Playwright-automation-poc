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
      .locator(
        'button[class*="BannerWidgetCarouselAutoScroll__slideDotsPlayPause"]',
      )
      .first();
    this.pauseIcon = this.playPauseButton.locator('img[alt="Pause"]');
    this.playIcon = this.playPauseButton.locator('img[alt="Play"]');

    // Deals Section
    this.dealsSectionTitle = page
      .getByRole("heading", { name: /super saving deals/i })
      .first();
    this.dealsSectionContainer = page
      .locator("div")
      .filter({ has: this.dealsSectionTitle })
      .filter({ has: page.getByText("See all", { exact: false }) })
      .first();
  }

  async navigate() {
    await this.page.goto("/", { waitUntil: "load" });
    await this.dismissOverlay();
  }

  // --- HERO CAROUSEL METHODS ---
  async getActiveSlideLabel(): Promise<string> {
    const activeDot = this.page
      .locator('div[class*="BannerWidgetCarouselAutoScroll__activeSliderDot"]')
      .first();
    await activeDot.waitFor({ state: "attached", timeout: 5000 });
    const label = await activeDot.getAttribute("aria-label");
    if (!label) throw new Error("Could not find aria-label on the active dot!");
    return label;
  }

  async togglePlayPause() {
    await this.playPauseButton.evaluate((btn: HTMLElement) => btn.click());
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

    const productCards = this.dealsSectionContainer
      .locator("a")
      .filter({ hasText: "₹" });
    await productCards.first().waitFor({ state: "attached", timeout: 5000 });

    const totalItems = await productCards.count();
    const targetCard = productCards.nth(totalItems - offset);

    const nextArrow = this.dealsSectionContainer
      .locator(
        '[class*="slider-arrow-right"], .slick-next, [aria-label="Next"], svg',
      )
      .filter({ hasText: ">" })
      .or(
        this.dealsSectionContainer.locator(
          '[class*="slider-arrow-right"], .slick-next, [aria-label="Next"]',
        ),
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
    const productHref = await targetCard.getAttribute("href");

    if (!productHref) throw new Error("Could not find the 'href' attribute!");

    await this.page.goto(productHref, { waitUntil: "domcontentloaded" });

    return cardTitleSnippet;
  }
}
