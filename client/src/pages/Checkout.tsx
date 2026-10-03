import { useMemo, useState, type SubmitEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Wire,
  MicroLabel,
  Divider,
  PageShell,
} from "../components/wireframe-primitives";
import { fmt } from "../components/wireframe-helpers";
import { useCart } from "../context/useCart";
import { useAuth } from "../context/useAuth";
import { apiRequest } from "../lib/api";
import {
  BUY_NOW_STORAGE_KEY,
  clearBuyNow,
  readBuyNow,
  type BuyNowItem,
} from "../lib/buyNow";
import { STATES, CITIES_BY_STATE } from "../data/nigeriaLocations";

// Order-level card payments are not wired yet (no initialize endpoint, no
// inline popup, verify-payment has no caller), so card orders would sit
// isPaid=false forever. Hide the option until Phase J wires it (option B).
// Listing-fee card payments via Paystack redirect are unaffected.
const PAYMENT_METHODS = ["Bank Transfer", "Pay on Delivery"];

export default function Checkout() {
  const { items, clearCart, removeFromCart, updateQty } = useCart();
  const { token, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // ── Buy Now context resolution (Phase I, step B) ─────────────────────────
  // Primary source: location.state from ProductDetail. Fallback: the
  // sessionStorage mirror, which survives a page refresh. There is NO silent
  // fallback to full-cart checkout — a stale mirror resolves to an explicit
  // "expired" state instead.
  const stateBuyNowItem = (
    location.state as { buyNowItem?: BuyNowItem } | null
  )?.buyNowItem;
  // Read the mirror on every navigation, not just on mount: "Cancel Buy
  // Now" replaces the location (new location.key) after clearing storage, so
  // the re-read must observe the cleared mirror and resolve to CART mode.
  const mirroredBuyNowItem = useMemo(
    () => readBuyNow(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location.key],
  );

  const hasStaleMirror =
    !stateBuyNowItem &&
    !mirroredBuyNowItem &&
    sessionStorage.getItem(BUY_NOW_STORAGE_KEY) !== null;

  const activeBuyNowItem = stateBuyNowItem ?? mirroredBuyNowItem;
  const isBuyNow = activeBuyNowItem != null;
  const checkoutItems = activeBuyNowItem ? [activeBuyNowItem] : items;
  const otherCartCount = activeBuyNowItem
    ? items
        .filter((item) => item.id !== activeBuyNowItem.id)
        .reduce((sum, item) => sum + item.qty, 0)
    : 0;
  const subtotal = checkoutItems.reduce(
    (sum, item) => sum + item.price * item.qty,
    0,
  );

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState(STATES[0]);
  const [payment, setPayment] = useState(PAYMENT_METHODS[0]);
  const [placing, setPlacing] = useState(false);

  // Delivery is NOT a flat platform rate: each seller sets their own fee per
  // listing, so a cart sums every applicable listing fee. It stays null until
  // the live products are fetched, and is only a preview — the server
  // recomputes it and rejects any mismatch.
  const [deliveryFee, setDeliveryFee] = useState<number | null>(null);
  const total = subtotal + (deliveryFee ?? 0);

  function cancelBuyNow() {
    clearBuyNow();
    navigate("/checkout", { replace: true, state: {} });
  }

  if (hasStaleMirror) {
    return (
      <div className="p-10 text-center">
        <p className="font-bold mb-4">
          Your Buy Now session has expired — it was never checked out, and
          your cart was not touched.
        </p>
        <button
          type="button"
          onClick={cancelBuyNow}
          className="underline font-bold"
        >
          Continue with your cart
        </button>
      </div>
    );
  }

  if (checkoutItems.length === 0) {
    return (
      <div className="p-10 text-center">
        <p className="font-bold mb-4">
          Your cart is empty — nothing to check out.
        </p>
      </div>
    );
  }

  
  const handlePlaceOrder = async (e: SubmitEvent) => {
    e.preventDefault();

    if (!name || !phone || !address || !city) {
      toast.error("Please fill in all delivery details");
      return;
    }

    setPlacing(true);

    try {
      // Re-fetch every cart item fresh from the backend before checkout,
      // rather than trusting whatever's been cached in localStorage.
      const freshResults = await Promise.all(
        checkoutItems.map((item) =>
          apiRequest(`/products/${item.id}`)
            .then((product) => ({ item, product }))
            .catch(() => ({ item, product: null })),
        ),
      );

      const unavailable = freshResults.filter((r) => !r.product);
      if (unavailable.length > 0) {
        unavailable.forEach((r) => {
          removeFromCart(r.item.id);
          toast.error(
            `${r.item.name} is no longer available and was removed from your cart`,
          );
        });
        setPlacing(false);
        return;
      }

      // ── Buy Now stock guard (Phase I, step C) ─────────────────────────
      // Live stock is authoritative. Abort with a toast (no auto-clamp) so
      // the buyer re-chooses a quantity instead of silently getting less.
      if (activeBuyNowItem) {
        const live = freshResults[0]?.product as {
          sellerId?: string;
          status?: string;
          stock?: number | null;
        } | null;
        if (live && user && live.sellerId === user.id) {
          toast.error("You can’t purchase a listing you created.");
          setPlacing(false);
          return;
        }
        if (live && live.status !== undefined && live.status !== "approved") {
          toast.error(
            `${activeBuyNowItem.name} is no longer available and was removed from your cart`,
          );
          removeFromCart(activeBuyNowItem.id);
          clearBuyNow();
          setPlacing(false);
          return;
        }
        if (
          live &&
          live.stock != null &&
          live.stock < activeBuyNowItem.qty
        ) {
          if (live.stock <= 0) {
            toast.error(
              `${activeBuyNowItem.name} is out of stock and was removed from your cart`,
            );
            removeFromCart(activeBuyNowItem.id);
            clearBuyNow();
          } else {
            toast.error(
              `Only ${live.stock} left of ${activeBuyNowItem.name}. Please go back and choose a smaller quantity.`,
            );
          }
          setPlacing(false);
          return;
        }
      }

      const freshItems = freshResults.map((r) => ({
        productId: r.product.id,
        name: r.product.name,
        price: r.product.price, // always the live price, not a stale cached one
        qty: r.item.qty,
        sellerId: r.product.sellerId, // always present now, never missing
        payoutStatus: "pending",
      }));

      const freshSubtotal = freshItems.reduce(
        (sum, i) => sum + i.price * i.qty,
        0,
      );

      // Delivery is whatever the SELLER set per listing, summed across every
      // listing in the cart. The server recomputes this and rejects a mismatch,
      // so this value is a display estimate, not the source of truth.
      const liveDeliveryFee = freshResults.reduce((sum, r) => {
        const product = r.product as {
          chargesDeliveryFee?: boolean | null;
          deliveryFeeAmount?: number | null;
        };
        return sum + (product?.chargesDeliveryFee ? Number(product.deliveryFeeAmount ?? 0) : 0);
      }, 0);

      setDeliveryFee(liveDeliveryFee);

      const order = await apiRequest("/orders", {
        method: "POST",
        token: token ?? undefined,
        body: {
          items: freshItems,
          shippingAddress: { name, phone, address, city, state },
          paymentMethod: payment,
          subtotal: freshSubtotal,
          deliveryFee: liveDeliveryFee,
        },
      });

      if (activeBuyNowItem) {
        // Buy Now checks out just that item and leaves the rest of the cart
        // intact. Subtract the purchased qty so a same-item remainder stays
        // in the cart instead of vaporizing the whole line.
        const cartLine = items.find((item) => item.id === activeBuyNowItem.id);
        const remaining = (cartLine?.qty ?? 0) - activeBuyNowItem.qty;
        if (remaining > 0) {
          updateQty(activeBuyNowItem.id, remaining);
        } else {
          removeFromCart(activeBuyNowItem.id);
        }
        clearBuyNow();
      } else {
        clearCart();
      }
      toast.success("Order placed!");
      navigate(`/orders/${order.id}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to place order";
      toast.error(message);
    } finally {
      setPlacing(false);
    }
  };

  return (
    <PageShell title="Checkout" breadcrumb="Cart / Delivery / Payment / Review">
      {/* Responsive: form stacks full width on mobile, order summary sits beside it from lg up */}
      {isBuyNow && activeBuyNowItem && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-2 border-black bg-neutral-50 p-4">
          <p className="text-[13px] font-bold">
            Buy Now: {activeBuyNowItem.name} × {activeBuyNowItem.qty} — only
            this item will be ordered.
            {otherCartCount > 0
              ? ` Your cart (${otherCartCount} other item${otherCartCount === 1 ? "" : "s"}) is untouched.`
              : " Your cart is untouched."}
            {!stateBuyNowItem && " (Restored after refresh.)"}
          </p>
          <button
            type="button"
            onClick={cancelBuyNow}
            className="text-[11px] font-black uppercase tracking-widest underline"
          >
            Cancel Buy Now
          </button>
        </div>
      )}
      <form onSubmit={handlePlaceOrder}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            {/* ── Delivery address ──────────────────────────────────── */}
            <section>
              <MicroLabel>1. Delivery Address</MicroLabel>
              <div className="border-2 border-black p-4 mt-3 space-y-3">
                <input
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-black/20 p-3 text-[13px] outline-none"
                />
                <input
                  placeholder="Phone Number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full border border-black/20 p-3 text-[13px] outline-none"
                />
                <input
                  placeholder="Street Address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full border border-black/20 p-3 text-[13px] outline-none"
                />

                {/* Responsive: two columns from sm up, stacked on mobile */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                    className="w-full border border-black/20 p-3 text-[13px] outline-none"
                  >
                    <option value="" disabled>
                      Select LGA
                    </option>
                    {CITIES_BY_STATE[state]?.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>

                  <select
                    value={state}
                    onChange={(e) => {
                      setState(e.target.value);
                      setCity(""); // reset city so an old LGA from a different state can't linger
                    }}
                    className="w-full border border-black/20 p-3 text-[13px] outline-none"
                  >
                    {STATES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <MicroLabel>
                  Delivery tracking is available in Osun, Lagos, and Oyo states
                </MicroLabel>
              </div>
            </section>

            {/* ── Payment method ────────────────────────────────────── */}
            <section>
              <MicroLabel>2. Payment Method</MicroLabel>
              <div className="mt-3 space-y-2">
                {PAYMENT_METHODS.map((m) => (
                  <label
                    key={m}
                    className={`flex items-center gap-3 border-2 p-4 cursor-pointer ${
                      payment === m ? "border-black" : "border-black/15"
                    }`}
                  >
                    <input
                      type="radio"
                      checked={payment === m}
                      onChange={() => setPayment(m)}
                      className="accent-black"
                    />
                    <span className="text-[13px] font-semibold">{m}</span>
                  </label>
                ))}
              </div>
            </section>

            {/* ── Order items review ────────────────────────────────── */}
            <section>
              <MicroLabel>3. Review Items</MicroLabel>
              <div className="space-y-3 mt-3">
                {checkoutItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 border border-black/15 p-3"
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-16 w-16 object-cover"
                      />
                    ) : (
                      <Wire h="h-16 w-16" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-bold">{item.name}</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        Qty {item.qty} · {fmt(item.price * item.qty)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* ── Order total + place order ──────────────────────────── */}
          <div className="lg:col-span-4">
            <div className="border-2 border-black p-5 sticky top-4">
              <MicroLabel>Order Total</MicroLabel>
              <div className="mt-4 space-y-3 text-[13px] font-semibold">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Subtotal</span>
                  <span>{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">
                    Delivery{deliveryFee === null ? " (calculated at checkout)" : ""}
                  </span>
                  <span>{deliveryFee === null ? "—" : fmt(deliveryFee)}</span>
                </div>
              </div>
              <Divider thick />
              <div className="flex justify-between text-[16px] font-black mt-3">
                <span>Total</span>
                <span>{fmt(total)}</span>
              </div>
              <button
                type="submit"
                disabled={placing}
                style={{ backgroundColor: "var(--vermilion)" }}
                className="w-full py-4 mt-5 text-white text-[11px] tracking-[0.2em] uppercase font-black disabled:opacity-60"
              >
                {placing ? "Placing Order…" : "Place Order"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </PageShell>
  );
}
