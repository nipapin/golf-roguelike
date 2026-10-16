/**
 * SDK Hooks - Placeholder interfaces for future monetization integrations.
 * 
 * This module defines hook points where ads or in-app purchase SDKs can be
 * integrated without modifying core game logic. All functions are no-ops
 * until a real SDK is connected.
 * 
 * IMPLEMENTATION NOTES:
 * - Replace placeholder implementations with your SDK of choice
 * - Popular options: Google AdMob, Unity Ads, RevenueCat, Stripe
 * - Ensure GDPR/CCPA consent is collected before showing personalized ads
 * - Test thoroughly on both iOS Safari and Android Chrome
 */

// ============================================================================
// ANALYTICS HOOKS (placeholder for future analytics SDK)
// ============================================================================

export interface AnalyticsEvent {
  name: string;
  params?: Record<string, string | number | boolean>;
}

/**
 * Log an analytics event. No-op until connected to an analytics service.
 * 
 * Recommended integration points:
 * - Game start/end
 * - Round completion (win/loss)
 * - Tutorial completion
 * - Settings changes
 * - Upgrade purchases
 * 
 * @example
 * logEvent({ name: 'round_complete', params: { round: 5, won: true, time: 120 } });
 */
export function logEvent(_event: AnalyticsEvent): void {
  // TODO: Connect to analytics SDK (e.g., Firebase Analytics, Amplitude)
  // Example: analytics.logEvent(event.name, event.params);
}

/**
 * Set user properties for analytics segmentation.
 */
export function setUserProperties(_props: Record<string, string | number | boolean>): void {
  // TODO: Connect to analytics SDK
  // Example: analytics.setUserProperties(props);
}

// ============================================================================
// ADVERTISING HOOKS (placeholder for future ads SDK)
// ============================================================================

export interface AdConfig {
  /** Unique identifier for the ad placement */
  placementId: string;
  /** Type of ad to show */
  type: 'banner' | 'interstitial' | 'rewarded';
}

export interface AdResult {
  /** Whether the ad was shown successfully */
  shown: boolean;
  /** For rewarded ads, whether the user earned the reward */
  rewarded?: boolean;
  /** Error message if the ad failed to show */
  error?: string;
}

/**
 * Check if ads are available and loaded.
 * Returns false until an ads SDK is integrated.
 */
export function isAdReady(_config: AdConfig): boolean {
  // TODO: Connect to ads SDK (e.g., AdMob, Unity Ads)
  // Example: return adsSDK.isReady(config.placementId);
  return false;
}

/**
 * Show an advertisement.
 * 
 * Recommended placements:
 * - Interstitial: After every 3 rounds (not during gameplay)
 * - Rewarded: Optional "watch ad" for extra gold or free revival
 * - Banner: Bottom of menu screen (respect safe-area-inset-bottom)
 * 
 * @returns Promise resolving to the ad result
 * 
 * @example
 * // Rewarded ad for bonus gold
 * const result = await showAd({ placementId: 'bonus_gold', type: 'rewarded' });
 * if (result.rewarded) {
 *   giveGold(100);
 * }
 */
export async function showAd(_config: AdConfig): Promise<AdResult> {
  // TODO: Connect to ads SDK
  // Example:
  // try {
  //   await adsSDK.show(config.placementId);
  //   return { shown: true, rewarded: config.type === 'rewarded' };
  // } catch (e) {
  //   return { shown: false, error: e.message };
  // }
  return { shown: false, error: 'Ads SDK not integrated' };
}

/**
 * Preload an ad for faster display later.
 */
export function preloadAd(_config: AdConfig): void {
  // TODO: Connect to ads SDK
  // Example: adsSDK.preload(config.placementId);
}

// ============================================================================
// IN-APP PURCHASE HOOKS (placeholder for future IAP SDK)
// ============================================================================

export interface Product {
  /** Product ID in the app store */
  id: string;
  /** Display name */
  name: string;
  /** Formatted price with currency symbol */
  price: string;
  /** Type: consumable (gold), non-consumable (remove ads), subscription */
  type: 'consumable' | 'non_consumable' | 'subscription';
}

export interface PurchaseResult {
  /** Whether the purchase completed successfully */
  success: boolean;
  /** The purchased product */
  product?: Product;
  /** Transaction ID for record-keeping */
  transactionId?: string;
  /** Error message if the purchase failed */
  error?: string;
}

/**
 * Get available products from the store.
 * Returns empty array until an IAP SDK is integrated.
 * 
 * Recommended products:
 * - Remove Ads (non_consumable): $2.99
 * - Gold Pack (consumable): $0.99, $4.99, $9.99 tiers
 * - Premium Pass (subscription): $1.99/month
 */
export async function getProducts(): Promise<Product[]> {
  // TODO: Connect to IAP SDK (e.g., RevenueCat, Stripe, app store native)
  // Example: return iapSDK.getProducts(['remove_ads', 'gold_100', 'gold_500']);
  return [];
}

/**
 * Purchase a product.
 * 
 * @example
 * const result = await purchase('remove_ads');
 * if (result.success) {
 *   setAdsRemoved(true);
 *   saveGame();
 * }
 */
export async function purchase(_productId: string): Promise<PurchaseResult> {
  // TODO: Connect to IAP SDK
  // Example:
  // try {
  //   const result = await iapSDK.purchase(productId);
  //   return { success: true, product: result.product, transactionId: result.id };
  // } catch (e) {
  //   return { success: false, error: e.message };
  // }
  return { success: false, error: 'IAP SDK not integrated' };
}

/**
 * Restore previous purchases (for non-consumables and subscriptions).
 * Required for iOS App Store compliance.
 */
export async function restorePurchases(): Promise<PurchaseResult[]> {
  // TODO: Connect to IAP SDK
  // Example: return iapSDK.restorePurchases();
  return [];
}

/**
 * Check if ads have been removed via purchase.
 */
export function hasRemovedAds(): boolean {
  // TODO: Check IAP purchase status
  // Example: return iapSDK.hasPurchased('remove_ads');
  return false;
}

// ============================================================================
// CONSENT MANAGEMENT (required for GDPR/CCPA compliance)
// ============================================================================

export type ConsentStatus = 'unknown' | 'granted' | 'denied';

/**
 * Check current consent status for personalized ads.
 */
export function getConsentStatus(): ConsentStatus {
  // TODO: Connect to consent management platform (CMP)
  // Example: return cmpSDK.getConsentStatus();
  return 'unknown';
}

/**
 * Show consent dialog if needed.
 * Must be called before showing any personalized ads.
 */
export async function requestConsent(): Promise<ConsentStatus> {
  // TODO: Connect to consent management platform
  // Example: return cmpSDK.requestConsent();
  return 'unknown';
}
