import { useMemo, useState, type SubmitEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, LockKeyhole } from "lucide-react";
import toast from "react-hot-toast";
import {
  Wire,
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

// Order-level card payments use the inline popup and server-side verification
// below; listing-fee payments use a separate Paystack redirect flow.
const PAYMENT_METHODS = ["Bank Transfer", "Pay on Delivery", "Card (Paystack)"];

export default function Checkout() {
  const { items, clearCart, removeFromCart, updateQty } = useCart();
  const { token, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  

 
  const stateBuyNowItem = (
    location.state as { buyNowItem?: BuyNowItem } | null
  )?.buyNowItem;
 
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

      // ── Phase J: Card (Paystack) — open inline popup, verify on success ──
      if (payment === "Card (Paystack)") {
        const reference = order.id;
        type PaystackOptions = {
          key: string;
          email: string;
          amount: number;
          ref: string;
          onSuccess: (reference: string) => void;
          onClose: () => void;
        };
        type PaystackHandler = { openIframe: () => void };
        const paystackWindow = window as unknown as {
          PaystackPop?: {
            setup: (options: PaystackOptions) => PaystackHandler | null;
          };
        };
        const handler = paystackWindow.PaystackPop?.setup({
          key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
          email: user?.email || "",
          amount: Math.round(order.total * 100), // kobo
          ref: reference,
          onSuccess: async (paidRef: string) => {
            try {
              await apiRequest(`/orders/${order.id}/verify-payment`, {
                method: "PATCH",
                token: token ?? undefined,
                body: { reference: paidRef },
              });
              if (activeBuyNowItem) {
                const cartLine = items.find(
                  (item) => item.id === activeBuyNowItem.id,
                );
                const remaining =
                  (cartLine?.qty ?? 0) - activeBuyNowItem.qty;
                if (remaining > 0) {
                  updateQty(activeBuyNowItem.id, remaining);
                } else {
                  removeFromCart(activeBuyNowItem.id);
                }
                clearBuyNow();
              } else {
                clearCart();
              }
              toast.success("Payment confirmed!");
              navigate(`/orders/${order.id}?paid=true`);
            } catch {
              toast.error(
                "Payment could not be verified — pay from My Orders.",
              );
              navigate(`/orders/${order.id}?paid=false`);
            }
          },
          onClose: () => {
            toast.error(
              "Payment cancelled — your order is unpaid. Pay from My Orders.",
            );
            navigate(`/orders/${order.id}?paid=false`);
          },
        });

        if (handler) {
          handler.openIframe();
        } else {
          toast.error(
            "Paystack failed to load. Try Bank Transfer instead.",
          );
          navigate(`/orders/${order.id}?paid=false`);
        }
        // Cart is cleared by the verify callback (or left intact on cancel).
        return;
      }

      // ── Bank Transfer / Pay on Delivery ──
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
    <PageShell title="Checkout" breadcrumb="HOME / CART / CHECKOUT">
      {/* Responsive: form stacks full width on mobile, order summary sits beside it from lg up */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-neutral-600">
          Secure checkout · Review your delivery and payment details.
        </p>
        <Link to="/cart" className="inline-flex items-center gap-2 text-sm font-semibold text-[#E63312] hover:underline">
          <ArrowLeft className="h-4 w-4" /> Edit cart
        </Link>
      </div>
      <ol className="mb-8 flex items-center gap-2 text-xs font-semibold sm:gap-4">
        <li className="flex items-center gap-2 text-green-700">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-50"><Check className="h-4 w-4" /></span>
          Cart
        </li>
        <li aria-hidden className="h-px flex-1 bg-neutral-200" />
        <li className="flex items-center gap-2 text-[#E63312]" aria-current="step">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E63312] text-white">2</span>
          Checkout
        </li>
        <li aria-hidden className="h-px flex-1 bg-neutral-200" />
        <li className="flex items-center gap-2 text-neutral-400">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100">3</span>
          Confirmation
        </li>
      </ol>
      {isBuyNow && activeBuyNowItem && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
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
            className="text-sm font-bold text-[#E63312] underline underline-offset-2"
          >
            Cancel Buy Now
          </button>
        </div>
      )}
      <form onSubmit={handlePlaceOrder}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="space-y-5 lg:col-span-8">
            {/* ── Delivery address ──────────────────────────────────── */}
            <section className="rounded-lg border border-neutral-200 bg-white p-4 sm:p-6">
              <div className="mb-4 flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-sm font-bold text-white">1</span>
                <div>
                  <h2 className="font-bold">Delivery address</h2>
                  <p className="mt-1 text-xs text-neutral-500">Where should we deliver your order?</p>
                </div>
              </div>
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-neutral-700">Full name</span>
                <input
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                  className="w-full rounded border border-neutral-300 p-3 text-sm outline-none focus:border-[#E63312] focus:ring-1 focus:ring-[#E63312]"
                />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-neutral-700">Phone number</span>
                <input
                  placeholder="Phone Number"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  required
                  className="w-full rounded border border-neutral-300 p-3 text-sm outline-none focus:border-[#E63312] focus:ring-1 focus:ring-[#E63312]"
                />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-neutral-700">Street address</span>
                <input
                  placeholder="Street Address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  autoComplete="street-address"
                  required
                  className="w-full rounded border border-neutral-300 p-3 text-sm outline-none focus:border-[#E63312] focus:ring-1 focus:ring-[#E63312]"
                />
                </label>

                {/* Responsive: two columns from sm up, stacked on mobile */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-neutral-700">LGA / City</span>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                    autoComplete="address-level2"
                    className="w-full rounded border border-neutral-300 p-3 text-sm outline-none focus:border-[#E63312] focus:ring-1 focus:ring-[#E63312]"
                  >
                    <option value="" disabled>
                      Select LGA
                    </option>
                    {CITIES_BY_STATE[state]?.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-neutral-700">State</span>
                  <select
                    value={state}
                    onChange={(e) => {
                      setState(e.target.value);
                      setCity(""); // reset city so an old LGA from a different state can't linger
                    }}
                    autoComplete="address-level1"
                    required
                    className="w-full rounded border border-neutral-300 p-3 text-sm outline-none focus:border-[#E63312] focus:ring-1 focus:ring-[#E63312]"
                  >
                    {STATES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  </label>
                </div>
                <p className="text-xs text-neutral-500">
                  Delivery tracking is available in Osun, Lagos, and Oyo states.
                </p>
              </div>
            </section>

            {/* ── Payment method ────────────────────────────────────── */}
            <section className="rounded-lg border border-neutral-200 bg-white p-4 sm:p-6">
              <div className="mb-4 flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-sm font-bold text-white">2</span>
                <div>
                  <h2 className="font-bold">Payment method</h2>
                  <p className="mt-1 text-xs text-neutral-500">Choose how you would like to pay.</p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {PAYMENT_METHODS.map((m) => (
                  <label
                    key={m}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${
                      payment === m ? "border-[#E63312] bg-red-50/40" : "border-neutral-200 hover:border-neutral-400"
                    }`}
                  >
                    <input
                      type="radio"
                      checked={payment === m}
                      onChange={() => setPayment(m)}
                      name="payment-method"
                      className="accent-[#E63312]"
                    />
                    <span className="flex-1 text-sm font-semibold">{m}</span>
                    {m === "Bank Transfer" && <span className="text-xs text-neutral-500">Account details after order</span>}
                    {m === "Pay on Delivery" && <span className="text-xs text-neutral-500">Where available</span>}
                    {m === "Card (Paystack)" && <span className="text-xs text-neutral-500">Secure payment</span>}
                  </label>
                ))}
              </div>
            </section>

            {/* ── Order items review ────────────────────────────────── */}
            <section className="rounded-lg border border-neutral-200 bg-white p-4 sm:p-6">
              <div className="mb-4 flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-sm font-bold text-white">3</span>
                <div>
                  <h2 className="font-bold">Review items</h2>
                  <p className="mt-1 text-xs text-neutral-500">Confirm quantities and items before placing your order.</p>
                </div>
              </div>
              <div className="mt-3 space-y-3">
                {checkoutItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 rounded border border-neutral-200 p-3"
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-16 w-16 rounded object-cover"
                      />
                    ) : (
                      <Wire h="h-16 w-16" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-bold">{item.name}</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        Qty {item.qty} · {fmt(item.price)} each
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-bold">{fmt(item.price * item.qty)}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* ── Order total + place order ──────────────────────────── */}
          <div className="lg:col-span-4">
            <div className="sticky top-4 rounded-lg border border-neutral-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Order summary</h2>
                <Link to="/cart" className="text-xs font-semibold text-[#E63312] hover:underline">Edit</Link>
              </div>
              <div className="mt-4 max-h-64 space-y-3 overflow-y-auto border-b border-neutral-200 pb-4">
                {checkoutItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    {item.image ? (
                      <img src={item.image} alt="" className="h-12 w-12 rounded object-cover" />
                    ) : (
                      <Wire h="h-12 w-12" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-xs font-semibold">{item.name}</p>
                      <p className="mt-1 text-xs text-neutral-500">Qty: {item.qty}</p>
                    </div>
                    <span className="shrink-0 text-xs font-bold">{fmt(item.price * item.qty)}</span>
                  </div>
                ))}
              </div>
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
                className="mt-5 flex w-full items-center justify-center gap-2 rounded bg-[#E63312] py-4 text-sm font-bold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LockKeyhole className="h-4 w-4" />
                {placing ? "Placing order…" : `Place order · ${fmt(total)}`}
              </button>
              <p className="mt-3 text-center text-[11px] leading-5 text-neutral-500">
                Your order is protected. Delivery is charged based on seller settings.
              </p>
            </div>
          </div>
        </div>
      </form>
    </PageShell>
  );
}
