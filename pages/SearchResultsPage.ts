import { Locator, Page, expect } from "@playwright/test";
import { BasePage } from "./BasePage";

export interface ProductDetails {
  name: string;
  packSize: string;
  sellingPrice: string;
  mrp: string;
  discount: string;
}

export class SearchResultsPage extends BasePage {
  readonly pageHeadingContainer: Locator;
  readonly productCards: Locator;
  readonly sortDropdownBtn: Locator;

  constructor(page: Page) {
    super(page);

    // 1. SEMANTIC: Find the sort button using its accessible role
    this.sortDropdownBtn = page
      .getByRole("button", { name: /Sort by/i })
      .first();

    // 2. RELATIONSHIP: Avoid structural hardcoding (no '..').
    // We find the header container by finding the deepest div that contains BOTH pieces of text.
    this.pageHeadingContainer = page
      .locator("div")
      .filter({ hasText: /Search results for/i })
      .filter({ hasText: /results\)/i })
      .last();

    // 3. BEHAVIORAL: Zero CSS classes. We define a product card dynamically:
    // "Any link on the page that contains an 'Add to cart' button inside it."
    this.productCards = page
      .getByRole("link")
      .filter({ has: page.getByRole("button", { name: /Add to cart/i }) });
  }

  async getHeadingDetails() {
    await this.pageHeadingContainer.waitFor({ state: "visible" });
    const text = await this.pageHeadingContainer.innerText();

    // Extract count using regex, e.g., "(145 results)" -> 145
    const match = text.match(/\((\d+)/);
    const totalCount = match ? parseInt(match[1], 10) : 0;

    return { fullText: text, totalCount };
  }

  async getCardCountOnPage(): Promise<number> {
    await this.productCards.first().waitFor({ state: "visible" });
    return await this.productCards.count();
  }

  async getCardDetails(index: number): Promise<ProductDetails> {
    const card = this.productCards.nth(index);
    await card.scrollIntoViewIfNeeded();

    // 1mg injects visually-hidden accessible labels ("Discounted Price:", "Original Price:")
    // We can pull the full rendered text of the card and parse it perfectly without a single CSS class.
    const fullText = await card.innerText();
    const lines = fullText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // The first image's alt text is highly reliable for the exact product name
    const imageAlt = await card.locator("img").first().getAttribute("alt");
    const name = imageAlt || lines[0];

    // Pack size usually contains identifiable keywords
    const packSize =
      lines.find((l) =>
        /strip of|bottle of|packet of|tube of|box of|combo pack/i.test(l),
      ) || "";

    // Helper to extract the exact value immediately following a screen-reader label
    const extractByLabel = (label: string) => {
      const index = lines.findIndex((l) => l.includes(label));
      if (index === -1) return "";

      const lineText = lines[index];
      const inlineValue = lineText.replace(label, "").trim();

      // If there's text remaining on the same line after removing the label, return it.
      // Otherwise, grab the next line down.
      if (inlineValue) {
        return inlineValue;
      }
      return index + 1 < lines.length ? lines[index + 1] : "";
    };

    return {
      name: name.trim(),
      packSize: packSize,
      // FIX: Fallback to Original Price if the item has no discount
      sellingPrice:
        extractByLabel("Discounted Price:") ||
        extractByLabel("Original Price:"),
      mrp: extractByLabel("Original Price:"),
      discount: extractByLabel("Discount Percentage:"),
    };
  }

  async sortPricesLowToHigh() {
    await this.safeClick(this.sortDropdownBtn);

    // REFACTORED: 1mg uses a radio button overlay, not a standard listbox.
    // We target the generic text block containing the option, which acts as the clickable label.
    const lowToHighOption = this.page.getByText("Price: low to high", {
      exact: true,
    });
    await this.safeClick(lowToHighOption);

    await expect(this.page).toHaveURL(/sort=price_low/);
    await this.page.waitForLoadState("domcontentloaded");
  }

  async getAllVisibleSellingPrices(): Promise<number[]> {
    await this.productCards.first().waitFor({ state: "visible" });

    // Get the formatted text of every card on the page in a single rapid network call
    const allCardTexts = await this.productCards.allInnerTexts();

    return allCardTexts
      .map((text) => {
        const lines = text.split("\n").map((l) => l.trim());

        // Items on sale use "Discounted Price:", items without sale use "Original Price:"
        const discountIdx = lines.findIndex((l) =>
          l.includes("Discounted Price:"),
        );
        const origIdx = lines.findIndex((l) => l.includes("Original Price:"));

        let priceText = "0";
        if (discountIdx !== -1) priceText = lines[discountIdx + 1];
        else if (origIdx !== -1) priceText = lines[origIdx + 1];

        // Strip the currency symbol and convert to pure Number
        return parseFloat(priceText.replace(/[^0-9.]/g, ""));
      })
      .filter((price) => price > 0);
  }

  // In pages/SearchResultsPage.ts
  async openProductByIndex(index: number) {
    const card = this.productCards.nth(index);

    // Safely click the product image inside the card to guarantee navigation.
    // This avoids invalid nested <a> tags and prevents accidentally hitting the 'Add to cart' button.
    await this.safeClick(card.locator("img").first());
  }
}
