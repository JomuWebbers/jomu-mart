import { useEffect, useMemo, useState, type SubmitEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, ImagePlusIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/useAuth";
import { apiRequest, apiUpload } from "../lib/api";
import { CATEGORIES, CATEGORY_NAMES } from "../data/categories";
import { CITIES_BY_STATE, STATES } from "../data/nigeriaLocations";
import { PageShell } from "../components/wireframe-primitives";

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type ListingForm = {
  name: string;
  description: string;
  price: string;
  originalPrice: string;
  category: string;
  subcategory: string;
  stock: string;
  negotiable: boolean;
  fulfillmentMethod: "dropoff" | "pickup";
  sellerState: string;
  sellerLga: string;
  sellerAddress: string;
  deliveryDays: string;
  chargesDeliveryFee: boolean;
  deliveryFeeAmount: string;
};

const INITIAL_FORM: ListingForm = {
  name: "",
  description: "",
  price: "",
  originalPrice: "",
  category: CATEGORY_NAMES[0],
  subcategory: "",
  stock: "1",
  negotiable: false,
  fulfillmentMethod: "dropoff",
  sellerState: STATES[0],
  sellerLga: "",
  sellerAddress: "",
  deliveryDays: "",
  chargesDeliveryFee: false,
  deliveryFeeAmount: "",
};

const inputClass = "w-full rounded-control border border-brand-border bg-brand-surface px-3.5 py-3 text-sm text-brand-charcoal outline-none transition focus:border-brand-evergreen focus:ring-2 focus:ring-brand-evergreen/15";
const labelClass = "mb-1.5 block text-xs font-bold text-brand-charcoal";

export default function SellProduct() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<ListingForm>(INITIAL_FORM);
  const [files, setFiles] = useState<File[]>([]);
  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);

  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const update = <K extends keyof ListingForm>(key: K, value: ListingForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleFiles = (selected: FileList | null) => {
    if (!selected) return;
    const incoming = Array.from(selected);
    if (files.length + incoming.length > MAX_IMAGES) {
      toast.error(`Choose up to ${MAX_IMAGES} product photos`);
      return;
    }
    if (incoming.some((file) => !file.type.startsWith("image/"))) {
      toast.error("Choose image files only");
      return;
    }
    if (incoming.some((file) => file.size > MAX_IMAGE_BYTES)) {
      toast.error("Each image must be 5 MB or smaller");
      return;
    }
    setFiles((current) => [...current, ...incoming]);
  };

  const continueToDelivery = (event: SubmitEvent) => {
    event.preventDefault();
    if (files.length === 0) {
      toast.error("Add at least one product photo");
      return;
    }
    if (Number(form.price) <= 0 || !Number.isFinite(Number(form.price))) {
      toast.error("Enter a valid price greater than zero");
      return;
    }
    if (form.originalPrice && Number(form.originalPrice) < Number(form.price)) {
      toast.error("Original price should be at least the selling price");
      return;
    }
    // Stock is enforced when orders are placed (0 = sold out, blank = unlimited),
    // so an accidental zero would silently make the listing unbuyable.
    if (form.stock === "") {
      toast.error("Enter how many units you have available");
      return;
    }
    if (!Number.isInteger(Number(form.stock)) || Number(form.stock) < 1) {
      toast.error("Stock must be a whole number of 1 or more");
      return;
    }
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    if (form.fulfillmentMethod === "pickup" && (!form.sellerLga || !form.sellerAddress.trim())) {
      toast.error("Add the pickup LGA and street address");
      return;
    }
    if (form.chargesDeliveryFee && (!form.deliveryFeeAmount || Number(form.deliveryFeeAmount) < 0)) {
      toast.error("Enter a valid delivery fee");
      return;
    }
    if (form.deliveryDays && (!Number.isInteger(Number(form.deliveryDays)) || Number(form.deliveryDays) < 1)) {
      toast.error("Delivery time must be at least one day");
      return;
    }
    if (!token) {
      toast.error("Sign in to submit a listing");
      return;
    }

    setSaving(true);
    try {
      const imageUrls: string[] = [];
      for (const file of files) {
        const data = new FormData();
        data.append("image", file);
        const uploaded = await apiUpload("/upload", data, token);
        imageUrls.push(uploaded.url);
      }

      const product = await apiRequest("/products", {
        method: "POST",
        token,
        body: {
          name: form.name.trim(),
          description: form.description.trim(),
          price: Number(form.price),
          originalPrice: form.originalPrice ? Number(form.originalPrice) : 0,
          image: imageUrls[0],
          images: imageUrls,
          category: form.category,
          subcategory: form.subcategory,
          stock: Number(form.stock || 0),
          negotiable: form.negotiable ? "yes" : "no",
          fulfillmentMethod: form.fulfillmentMethod,
          sellerState: form.fulfillmentMethod === "pickup" ? form.sellerState : null,
          sellerLga: form.fulfillmentMethod === "pickup" ? form.sellerLga : null,
          sellerAddress: form.fulfillmentMethod === "pickup" ? form.sellerAddress.trim() : null,
          deliveryDays: form.deliveryDays ? Number(form.deliveryDays) : null,
          chargesDeliveryFee: form.chargesDeliveryFee,
          deliveryFeeAmount: form.chargesDeliveryFee ? Number(form.deliveryFeeAmount) : 0,
        },
      });

      const fee = await apiRequest(`/products/${product.id}/listing-fee/initialize`, {
        method: "POST",
        token,
      });

      if (fee.freeListing) {
        toast.success(
          fee.freeRemaining > 0
            ? `Listing submitted for review. Free listing ${fee.freeUsed} of 5 used — ${fee.freeRemaining} left.`
            : `Listing submitted for review. That was your 5th free listing — your next listing costs ₦1,000, taken from your seller balance.`,
        );
        navigate("/");
        return;
      }

      if (fee.paidViaWallet) {
        toast.success(
          `Listing submitted for review. ₦1,000 monthly fee deducted from your balance (₦${Number(fee.newBalance ?? 0).toLocaleString()} left).`,
        );
        navigate("/");
        return;
      }

      if (fee.requiresPayment) {
        window.location.assign(fee.authorizationUrl);
        return;
      }

      toast.success("Listing submitted for review. Your monthly fee is already paid.");
      navigate("/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit your listing");
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <PageShell title="Sell on Jomu Mart" breadcrumb="SELLER CENTRE">
        <div className="max-w-2xl rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-card md:p-10">
          <p className="text-sm text-brand-muted">Sign in or create an account to submit a product listing.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/login" className="rounded-control bg-brand-evergreen px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-evergreen-strong">Sign in</Link>
            <Link to="/register" className="rounded-control border border-brand-border px-5 py-3 text-sm font-bold text-brand-charcoal transition-colors hover:border-brand-evergreen hover:text-brand-evergreen">Create account</Link>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Sell on Jomu Mart" breadcrumb="SELLER CENTRE / NEW LISTING">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-brand-border bg-brand-surface p-4 sm:p-5" aria-label={`Step ${step} of 2`}>
          {[1, 2].map((number) => (
            <div key={number} className="flex flex-1 items-center gap-3">
              <div className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-black ${number <= step ? "bg-brand-evergreen text-white" : "border border-brand-border bg-brand-surface text-brand-muted"}`}>
                {number < step ? <CheckIcon className="size-4" /> : number}
              </div>
              <span className={`text-xs font-semibold ${step === number ? "text-brand-evergreen" : "text-brand-muted"}`}>
                {number === 1 ? "Product details" : "Delivery & review"}
              </span>
              {number === 1 && <div className="h-px flex-1 bg-brand-border" />}
            </div>
          ))}
        </div>

        {step === 1 ? (
          <form onSubmit={continueToDelivery} className="space-y-7 rounded-2xl border border-brand-border bg-brand-surface p-5 shadow-card sm:p-7 md:p-8">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-brand-charcoal">What are you selling?</h2>
              <p className="mt-1 text-sm text-brand-muted">Add clear details and photos so customers know exactly what to expect.</p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className={labelClass}>Product name</span>
                <input className={inputClass} value={form.name} onChange={(e) => update("name", e.target.value)} maxLength={120} required placeholder="e.g. Samsung Galaxy A55 5G" />
              </label>
              <label>
                <span className={labelClass}>Category</span>
                <select className={inputClass} value={form.category} onChange={(e) => setForm((current) => ({ ...current, category: e.target.value, subcategory: "" }))}>
                  {CATEGORY_NAMES.map((category) => <option key={category}>{category}</option>)}
                </select>
              </label>
              <label>
                <span className={labelClass}>Subcategory</span>
                <select className={inputClass} value={form.subcategory} onChange={(e) => update("subcategory", e.target.value)} required>
                  <option value="">Choose a subcategory</option>
                  {CATEGORIES[form.category]?.map((subcategory) => <option key={subcategory}>{subcategory}</option>)}
                </select>
              </label>
              <label>
                <span className={labelClass}>Selling price (₦)</span>
                <input className={inputClass} type="number" min="1" step="1" value={form.price} onChange={(e) => update("price", e.target.value)} required placeholder="0" />
              </label>
              <label>
                <span className={labelClass}>Original price (₦, optional)</span>
                <input className={inputClass} type="number" min="0" step="1" value={form.originalPrice} onChange={(e) => update("originalPrice", e.target.value)} placeholder="For showing a discount" />
              </label>
              <label>
                <span className={labelClass}>Available stock</span>
                <input className={inputClass} type="number" min="1" step="1" value={form.stock} onChange={(e) => update("stock", e.target.value)} required placeholder="How many units you can sell" />
                <span className="mt-2 block text-xs text-neutral-500">
                  Stock is reduced automatically every time one of these sells.
                </span>
              </label>
              <label className="flex items-end pb-3">
                <span className="flex items-center gap-3 text-sm">
                  <input type="checkbox" checked={form.negotiable} onChange={(e) => update("negotiable", e.target.checked)} className="size-4 accent-brand-evergreen" />
                  Price is negotiable
                </span>
              </label>
              <label className="md:col-span-2">
                <span className={labelClass}>Description</span>
                <textarea className={`${inputClass} min-h-32 resize-y`} value={form.description} onChange={(e) => update("description", e.target.value)} maxLength={3000} required placeholder="Describe the item, its condition, size, colour, or other useful details." />
                <span className="mt-1 block text-right text-[10px] text-neutral-400">{form.description.length}/3000</span>
              </label>
            </div>

            <div>
              <div className="mb-2 flex items-end justify-between gap-3">
                <div>
                  <span className={labelClass}>Product photos</span>
                  <p className="text-xs text-neutral-500">Up to {MAX_IMAGES} images, 5 MB each. The first photo is the cover.</p>
                </div>
                <span className="text-xs font-bold">{files.length}/{MAX_IMAGES}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                {files.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="relative aspect-square overflow-hidden rounded-xl border border-brand-border bg-brand-cream">
                    <img src={previews[index]} alt={`Product photo ${index + 1}`} className="size-full object-cover" />
                    {index === 0 && <span className="absolute bottom-0 left-0 rounded-tr-lg bg-brand-evergreen px-2.5 py-1.5 text-[10px] font-bold text-white">Cover photo</span>}
                    <button type="button" onClick={() => setFiles((current) => current.filter((_, i) => i !== index))} aria-label={`Remove photo ${index + 1}`} className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-brand-surface text-brand-charcoal shadow"><XIcon className="size-4" /></button>
                  </div>
                ))}
                {files.length < MAX_IMAGES && (
                  <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-border bg-brand-cream/50 text-center text-brand-evergreen transition-colors hover:border-brand-evergreen hover:bg-brand-cream">
                    <ImagePlusIcon className="size-7" />
                    <span className="text-xs font-bold">Add photos</span>
                    <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { handleFiles(e.target.files); e.currentTarget.value = ""; }} />
                  </label>
                )}
              </div>
            </div>

            <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-control bg-brand-evergreen px-5 py-4 text-sm font-bold text-white transition-colors hover:bg-brand-evergreen-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-evergreen">
              Continue to delivery <ArrowRightIcon aria-hidden="true" className="size-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-7 rounded-2xl border border-brand-border bg-brand-surface p-5 shadow-card sm:p-7 md:p-8">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-brand-charcoal">How will we collect and deliver it?</h2>
              <p className="mt-1 text-sm text-brand-muted">Choose how your item gets from you to our fulfilment network.</p>
            </div>

            <fieldset>
              <legend className={`${labelClass} mb-3`}>Getting the item to Jomu Mart</legend>
              <div className="grid gap-3 md:grid-cols-2">
                {([
                  ["dropoff", "I will drop it off", "You bring the item to the Jomu Mart warehouse for your state."],
                  ["pickup", "Arrange a pickup", "We arrange collection from your address before the customer delivery."],
                ] as const).map(([value, title, description]) => (
                  <label key={value} className={`cursor-pointer rounded-xl border p-4 transition-colors ${form.fulfillmentMethod === value ? "border-brand-evergreen bg-brand-cream/70" : "border-brand-border hover:border-brand-evergreen/50"}`}>
                    <span className="flex items-start gap-3">
                      <input type="radio" name="fulfillmentMethod" value={value} checked={form.fulfillmentMethod === value} onChange={() => update("fulfillmentMethod", value)} className="mt-1 accent-brand-evergreen" />
                      <span><span className="block text-sm font-bold text-brand-charcoal">{title}</span><span className="mt-1 block text-xs leading-5 text-brand-muted">{description}</span></span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {form.fulfillmentMethod === "pickup" && (
              <div className="grid gap-5 rounded-xl border-l-2 border-brand-evergreen bg-brand-cream/50 p-4 md:grid-cols-2">
                <label>
                  <span className={labelClass}>State</span>
                  <select className={inputClass} value={form.sellerState} onChange={(e) => setForm((current) => ({ ...current, sellerState: e.target.value, sellerLga: "" }))}>
                    {STATES.map((state) => <option key={state}>{state}</option>)}
                  </select>
                </label>
                <label>
                  <span className={labelClass}>Local government area</span>
                  <select className={inputClass} value={form.sellerLga} onChange={(e) => update("sellerLga", e.target.value)} required>
                    <option value="">Choose an LGA</option>
                    {CITIES_BY_STATE[form.sellerState]?.map((lga) => <option key={lga}>{lga}</option>)}
                  </select>
                </label>
                <label className="md:col-span-2">
                  <span className={labelClass}>Pickup street address</span>
                  <textarea className={inputClass} rows={2} value={form.sellerAddress} onChange={(e) => update("sellerAddress", e.target.value)} required placeholder="Street, area, nearest landmark" />
                </label>
              </div>
            )}

            <div className="grid gap-5 md:grid-cols-2">
              <label>
                <span className={labelClass}>Estimated delivery time (days)</span>
                <input className={inputClass} type="number" min="1" step="1" value={form.deliveryDays} onChange={(e) => update("deliveryDays", e.target.value)} placeholder="Optional" />
              </label>
              <div>
                <span className={`${labelClass} block`}>Extra seller delivery fee</span>
                <label className="flex min-h-12 items-center gap-3 text-sm">
                  <input type="checkbox" checked={form.chargesDeliveryFee} onChange={(e) => update("chargesDeliveryFee", e.target.checked)} className="size-4 accent-brand-evergreen" />
                  I charge an additional delivery fee
                </label>
              </div>
              {form.chargesDeliveryFee && (
                <label className="md:col-span-2">
                  <span className={labelClass}>Additional fee (₦)</span>
                  <input className={inputClass} type="number" min="0" step="1" value={form.deliveryFeeAmount} onChange={(e) => update("deliveryFeeAmount", e.target.value)} required placeholder="0" />
                  <span className="mt-1 block text-xs text-brand-muted">Buyers will see this delivery fee at checkout.</span>
                </label>
              )}
            </div>

            <div className="rounded-xl border border-brand-border bg-brand-cream/60 p-4 text-sm leading-6 text-brand-muted">
              <p className="font-bold text-brand-charcoal">Listing fee</p>
              <p className="mt-1">Your first five listings are free. After that, a ₦1,000 monthly seller fee applies when due and can be paid from your wallet or through Paystack.</p>
              <p className="mt-2">Your listing is submitted for review after the required fee is confirmed.</p>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button type="button" onClick={() => { setStep(1); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="flex items-center justify-center gap-2 rounded-control border border-brand-border px-5 py-4 text-sm font-bold text-brand-charcoal transition-colors hover:border-brand-evergreen hover:text-brand-evergreen">
                <ArrowLeftIcon className="size-4" /> Back to product details
              </button>
              <button type="submit" disabled={saving} className="flex items-center justify-center gap-2 rounded-control bg-brand-evergreen px-6 py-4 text-sm font-bold text-white transition-colors hover:bg-brand-evergreen-strong disabled:cursor-not-allowed disabled:opacity-60">
                {saving ? <><LoaderCircleIcon className="size-4 animate-spin" /> Uploading & submitting…</> : "Submit listing for review"}
              </button>
            </div>
          </form>
        )}
        </div>

        <aside className="h-fit space-y-4 rounded-2xl border border-brand-border bg-brand-surface p-5 shadow-card lg:sticky lg:top-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-evergreen">A smoother listing</p>
            <h2 className="mt-2 text-lg font-bold text-brand-charcoal">A few things to know</h2>
          </div>
          <ul className="space-y-4 text-sm leading-5 text-brand-muted">
            <li>
              <span className="block font-semibold text-brand-charcoal">Clear photos help</span>
              Use bright, accurate photos. Your first photo is the cover image.
            </li>
            <li>
              <span className="block font-semibold text-brand-charcoal">Add the details</span>
              Include condition, size, colour, and anything buyers should know.
            </li>
            <li>
              <span className="block font-semibold text-brand-charcoal">Know the fee</span>
              Five free listings, then ₦1,000 monthly when a listing fee is due.
            </li>
          </ul>
          <div className="rounded-xl bg-brand-cream p-4 text-xs leading-5 text-brand-muted">
            Listings are reviewed before they go live. You can go back and edit product details before submitting.
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
