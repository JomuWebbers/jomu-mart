/**
 * Buy Now session mirror.
 *
 * A Buy Now checkout rides on `location.state` (primary) plus this
 * The mirror is NEVER authoritative for checkout data: price, seller,
 * approval status and stock are always re-read from the backend at order
 * time, so live data wins. The mirror exists only so a page refresh does not
 * silently degrade a Buy Now into a full-cart checkout.
 */
export type BuyNowItem = {
  id: string;
  name: string;
  price: number;
  image: string;
  sellerId: string;
  qty: number;
};

export const BUY_NOW_STORAGE_KEY = "naija-mart:buy-now";

/** A mirrored Buy Now older than this is ignored (prevents week-old ghosts). */
export const BUY_NOW_FRESH_MS = 30 * 60 * 1000;

type StoredBuyNow = BuyNowItem & { at: number };

export function saveBuyNow(item: BuyNowItem) {
  try {
    const stored: StoredBuyNow = { ...item, at: Date.now() };
    sessionStorage.setItem(BUY_NOW_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage unavailable (private mode, etc.) — location.state still works.
  }
}

export function readBuyNow(): BuyNowItem | null {
  try {
    const raw = sessionStorage.getItem(BUY_NOW_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredBuyNow>;
    if (typeof parsed.id !== "string" || !parsed.id) return null;
    if (typeof parsed.qty !== "number" || parsed.qty < 1) return null;
    if (typeof parsed.at !== "number" || Date.now() - parsed.at > BUY_NOW_FRESH_MS) {
      return null;
    }
    return {
      id: parsed.id,
      name: typeof parsed.name === "string" ? parsed.name : "",
      price: typeof parsed.price === "number" ? parsed.price : 0,
      image: typeof parsed.image === "string" ? parsed.image : "",
      sellerId: typeof parsed.sellerId === "string" ? parsed.sellerId : "",
      qty: Math.floor(parsed.qty),
    };
  } catch {
    return null;
  }
}

export function clearBuyNow() {
  try {
    sessionStorage.removeItem(BUY_NOW_STORAGE_KEY);
  } catch {
    // Ignore — nothing to clear.
  }
}
