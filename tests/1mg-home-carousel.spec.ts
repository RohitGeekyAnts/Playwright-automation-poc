import { expect, test } from "@playwright/test";

test("1mg Home Page - Auto-Scroll, Pause, and Play Validation", async ({
  page,
}) => {
  // ==========================================
  // STEP 1: Navigation
  // ==========================================
  await page.goto("/", { waitUntil: "load" });
  await expect(page).toHaveURL(/https:\/\/www\.1mg\.com\/?$/);

  const screenOverlay = page.locator(".bg_power_overlay.show");
  try {
    await screenOverlay.waitFor({ state: "visible", timeout: 3000 });
    await page.locator('.bg_power_close, [aria-label="Close"]').first().click();
    await screenOverlay.waitFor({ state: "hidden", timeout: 3000 });
  } catch (error) {}

  // ==========================================
  // STEP 2: Locate Controls using exact HTML classes
  // ==========================================
  console.log("Locating the main hero carousel controls...");

  // Target the exact wrapper for the Play/Pause button using 1mg's unique class prefix
  const playPauseButton = page
    .locator(
      'button[class*="BannerWidgetCarouselAutoScroll__slideDotsPlayPause"]',
    )
    .first();

  // Look for the images inside that specific button to verify state
  const pauseIcon = playPauseButton.locator('img[alt="Pause"]');
  const playIcon = playPauseButton.locator('img[alt="Play"]');

  await playPauseButton.waitFor({ state: "attached", timeout: 15000 });

  // Bring it smoothly into view so it's ready for interaction
  await playPauseButton.scrollIntoViewIfNeeded();

  // Target the active dot using its specific class name
  const getActiveSlideLabel = async () => {
    const activeDot = page
      .locator('div[class*="BannerWidgetCarouselAutoScroll__activeSliderDot"]')
      .first();
    await activeDot.waitFor({ state: "attached", timeout: 5000 });

    const label = await activeDot.getAttribute("aria-label");
    if (!label) throw new Error("Could not find aria-label on the active dot!");
    return label;
  };

  // ==========================================
  // STEP 3: Verify Auto-Scroll is working
  // ==========================================
  console.log("Verifying auto-scroll moves the carousel...");

  const startSlide = await getActiveSlideLabel();
  console.log(`Starting on: ${startSlide}`);

  await page.waitForTimeout(6500);

  const afterScrollSlide = await getActiveSlideLabel();
  console.log(`Auto-scrolled to: ${afterScrollSlide}`);

  expect(afterScrollSlide).not.toBe(startSlide);
  console.log("✅ Auto-scroll confirmed.");

  // ==========================================
  // STEP 4: Verify Pause CTA
  // ==========================================
  console.log("Testing Pause CTA...");

  // NATIVE JS CLICK: 100% immune to sticky headers and overlay interceptions
  await playPauseButton.evaluate((btn: HTMLElement) => btn.click());

  await expect(playIcon).toBeAttached({ timeout: 5000 });

  const pausedSlide = await getActiveSlideLabel();
  console.log(`Paused on: ${pausedSlide}`);

  await page.waitForTimeout(6500);

  const afterPauseWaitSlide = await getActiveSlideLabel();

  expect(afterPauseWaitSlide).toBe(pausedSlide);
  console.log("✅ Pause CTA confirmed: Slider remained completely static.");

  // ==========================================
  // STEP 5: Verify Play CTA
  // ==========================================
  console.log("Testing Play CTA...");

  await playPauseButton.evaluate((btn: HTMLElement) => btn.click());

  await expect(pauseIcon).toBeAttached({ timeout: 5000 });

  await page.waitForTimeout(6500);

  const resumedSlide = await getActiveSlideLabel();
  console.log(`Resumed on: ${resumedSlide}`);

  expect(resumedSlide).not.toBe(pausedSlide);
  console.log("✅ Play CTA confirmed: Auto-scroll resumed.");
});
