import { Locator, Page, expect } from "@playwright/test";
import { BasePage } from "./BasePage";

export class HomePage extends BasePage {
  // Hero Carousel Locators
  readonly playPauseButton: Locator;
  readonly pauseIcon: Locator;
  readonly playIcon: Locator;

  // Deals Carousel Locators
  readonly dealsSectionTitle: Locator;
  readonly dealsSectionContainer: Locator;
  readonly dealCards: Locator;
  readonly dealsNextArrow: Locator;

  // Header Locators
  readonly locationSelectorInput: Locator;
  readonly locationSelectorBtn: Locator;
  readonly locationDropdown: Locator;
  readonly searchInput: Locator;
  readonly searchSubmitBtn: Locator;
  readonly cartBadgeCount: Locator;

  constructor(page: Page) {
    super(page);

    // Hero Carousel
    // FIX: Added fallbacks to check the 'src' attribute if the 'alt' text is missing in Firefox
    this.playPauseButton = page
      .locator('button, [class*="slideDotsPlayPause"]')
      .filter({
        has: page.locator(
          'img[alt="Play"], img[alt="Pause"], img[src*="play" i], img[src*="pause" i]',
        ),
      })
      .first();

    this.pauseIcon = this.playPauseButton.locator(
      'img[alt="Pause"], img[src*="pause" i]',
    );

    this.playIcon = this.playPauseButton.locator(
      'img[alt="Play"], img[src*="play" i]',
    );

    // Deals Section
    // FIX: The old '[class*="Carousel__slide"]' selector no longer matches anything.
    // Anchor on stable things instead: the section heading and the product links
    // (every product card is a link to /otc/... or /drugs/...).
    const productLinkSelector = 'a[href^="/otc/"], a[href^="/drugs/"]';

    this.dealsSectionTitle = page
      .getByRole("heading", { name: /super saving deals/i })
      .first();

    // Innermost container that holds both the heading and the product cards.
    // Ancestors also match, but they come earlier in the DOM, so .last() is the innermost.
    this.dealsSectionContainer = page
      .locator("div")
      .filter({ has: this.dealsSectionTitle })
      .filter({ has: page.locator(productLinkSelector) })
      .last();

    this.dealCards = this.dealsSectionContainer.locator(productLinkSelector);

    // The arrow is an <img alt="next"> on the page, but a <button name="Next"> in the hero.
    this.dealsNextArrow = this.dealsSectionContainer
      .getByRole("img", { name: /^next$/i })
      .or(this.dealsSectionContainer.getByRole("button", { name: /^next$/i }))
      .first();

    // Uses the accessible placeholder name to find the input field
    this.locationSelectorInput = page
      .getByRole("textbox", { name: /enter your city/i })
      .first();

    // Map Btn to Input to ensure backward compatibility with your spec file
    this.locationSelectorBtn = this.locationSelectorInput;

    // Matches the new generic div structure for the dropdown by looking for known headers inside it
    this.locationDropdown = page
      .locator("div")
      .filter({ hasText: "Popular cities" })
      .filter({ hasText: "All cities" })
      .last();

    // Uses the accessible placeholder name for the main search bar
    this.searchInput = page
      .getByRole("textbox", {
        name: /Search for Medicines and Health Products/i,
      })
      .first();

    // Targets the search icon image directly
    this.searchSubmitBtn = page.locator('img[alt="search icon"]').first();

    // Target the main cart link wrapper, as inner span classes change frequently
    this.cartBadgeCount = page.locator('a[href="/cart"]').first();
  }

  async navigate() {
    await this.page.goto("/", { waitUntil: "domcontentloaded" });
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

  async waitForSlideToChange(initialLabel: string) {
    await expect(async () => {
      const currentLabel = await this.getActiveSlideLabel();
      expect(currentLabel).not.toBe(initialLabel);
    }).toPass({ timeout: 15000 });
  }

  // --- DEALS CAROUSEL METHODS ---
  async scrollToDealsSection() {
    await this.dealsSectionTitle.scrollIntoViewIfNeeded();
    await this.page.mouse.wheel(0, 500);
    await this.dismissVisibleOverlay();
  }

  async openDealProductFromEnd(offset: number): Promise<string> {
    // Web-first assertion: retries until the deals cards render, with a clear error if not.
    // (Replaces the old page-wide getByText("₹") wait, which matched any price on the page.)
    await expect(this.dealCards.first()).toBeVisible({ timeout: 10000 });

    const totalItems = await this.dealCards.count();
    if (totalItems < offset) {
      throw new Error(
        `Expected at least ${offset} deal cards but found ${totalItems}.`,
      );
    }
    const targetCard = this.dealCards.nth(totalItems - offset);

    const MAX_SCROLL_ATTEMPTS = 15;

    for (let attempt = 0; attempt < MAX_SCROLL_ATTEMPTS; attempt++) {
      if (await targetCard.isVisible()) {
        break;
      }

      await this.dealsSectionContainer.hover();

      if (!(await this.dealsNextArrow.isVisible())) {
        break;
      }

      await this.dealsNextArrow.click();

      try {
        await expect(targetCard).toBeVisible({ timeout: 1000 });
        break;
      } catch {
        // Continue to the next loop iteration (click again) if it's still not visible
      }
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

    await this.safeClick(targetCard);
    await this.page.waitForLoadState("domcontentloaded");

    return cardTitleSnippet;
  }

  // --- LOCATION & HEADER METHODS ---

  async getCurrentCity(): Promise<string> {
    await this.locationSelectorInput.waitFor({
      state: "visible",
      timeout: 5000,
    });
    return (await this.locationSelectorInput.inputValue()).trim();
  }

  async openLocationDropdownAndGetCities(): Promise<string[]> {
    await this.safeClick(this.locationSelectorInput);

    const allCitiesHeader = this.page
      .getByText("All cities", { exact: true })
      .last();
    await allCitiesHeader.waitFor({ state: "visible", timeout: 5000 });

    const fullText = await this.locationDropdown.innerText();
    const allListItems = fullText
      .split("\n")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    const allCitiesIndex = allListItems.findIndex(
      (text) => text.toLowerCase() === "all cities",
    );

    if (allCitiesIndex !== -1) {
      return allListItems.slice(allCitiesIndex + 1);
    }

    return allListItems;
  }

  async selectCity(cityName: string) {
    const locationInput = this.locationSelectorInput;

    // FAST PATH: If the city is already correctly set, skip the UI interaction entirely!
    const currentCity = await locationInput.inputValue();
    if (currentCity.trim().toLowerCase() === cityName.toLowerCase()) {
      return;
    }

    // FIX: partial class match survives the hash suffix changing on each deploy
    // (was '.LocationPicker__cityItem__t7eLq').
    const cityOption = this.page
      .locator("div")
      .filter({ has: locationInput })
      .filter({ has: this.page.getByText(cityName, { exact: true }) })
      .last()
      .getByText(cityName, { exact: true });

    await expect(async () => {
      await this.dismissVisibleOverlay();
      await this.page.keyboard.press("Escape");
      await this.page.waitForTimeout(500);

      await locationInput.click({ timeout: 3000 });
      await locationInput.clear();
      await locationInput.pressSequentially(cityName, { delay: 100 });

      await cityOption.waitFor({ state: "visible", timeout: 4000 });
      await cityOption.click({ timeout: 3000 });

      await expect(locationInput).toHaveValue(new RegExp(cityName, "i"), {
        timeout: 3000,
      });
    }).toPass({ timeout: 25000 });
  }

  // --- NEW FLOW 2 METHODS ---

  async searchFor(query: string) {
    await this.searchInput.waitFor({ state: "visible" });
    await this.searchInput.fill(query);
    await this.searchInput.press("Enter");
  }

  async getCartBadgeCount(): Promise<number> {
    if (!(await this.cartBadgeCount.isVisible())) {
      return 0; // If badge is hidden, count is 0
    }
    const text = await this.cartBadgeCount.innerText();

    const count = parseInt(text.replace(/[^0-9]/g, ""), 10);
    return isNaN(count) ? 0 : count;
  }
}
