import { expect, test } from "@playwright/test";
import { HomePage } from "../pages/HomePage";

test("1mg Home Page - Auto-Scroll, Pause, and Play Validation", async ({
  page,
}) => {
  const homePage = new HomePage(page);

  await homePage.navigate();
  await homePage.playPauseButton.waitFor({ state: "attached", timeout: 15000 });
  await homePage.playPauseButton.scrollIntoViewIfNeeded();

  // 1. Verify Auto-Scroll
  const startSlide = await homePage.getActiveSlideLabel();
  await homePage.waitForSlideTransition();
  const afterScrollSlide = await homePage.getActiveSlideLabel();
  expect(afterScrollSlide).not.toBe(startSlide);

  // 2. Verify Pause CTA
  await homePage.togglePlayPause();
  await expect(homePage.playIcon).toBeAttached({ timeout: 5000 });
  const pausedSlide = await homePage.getActiveSlideLabel();
  await homePage.waitForSlideTransition();
  const afterPauseWaitSlide = await homePage.getActiveSlideLabel();
  expect(afterPauseWaitSlide).toBe(pausedSlide);

  // 3. Verify Play CTA
  await homePage.togglePlayPause();
  await expect(homePage.pauseIcon).toBeAttached({ timeout: 5000 });
  await homePage.waitForSlideTransition();
  const resumedSlide = await homePage.getActiveSlideLabel();
  expect(resumedSlide).not.toBe(pausedSlide);
});
