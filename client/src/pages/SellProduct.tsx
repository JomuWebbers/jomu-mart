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

const inputClass = "w-full border-2 border-black/20 px-3 py-3 text-sm outline-none focus:border-black";
const labelClass = "mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em]";

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
    if (form.stock && (!Number.isInteger(Number(form.stock)) || Number(form.stock) < 0)) {
      toast.error("Stock must be a whole number of zero or more");
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
      <PageShell title="Sell on Naija Mart" breadcrumb="SELLER CENTRE">
        <div className="max-w-2xl border-2 border-black p-6 md:p-10">
          <p className="text-sm text-neutral-600">Sign in or create an account to submit a product listing.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/login" className="bg-black px-5 py-3 text-xs font-bold uppercase tracking-widest text-white">Sign in</Link>
            <Link to="/register" className="border-2 border-black px-5 py-3 text-xs font-bold uppercase tracking-widest">Create account</Link>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Sell on Naija Mart" breadcrumb="SELLER CENTRE / NEW LISTING">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center gap-3" aria-label={`Step ${step} of 2`}>
          {[1, 2].map((number) => (
            <div key={number} className="flex flex-1 items-center gap-3">
              <div className={`flex size-9 shrink-0 items-center justify-center border-2 border-black text-xs font-black ${step === number ? "bg-black text-white" : number < step ? "bg-black text-white" : "bg-white"}`}>
                {number < step ? <CheckIcon className="size-4" /> : number}
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-[0.12em] ${step === number ? "text-black" : "text-neutral-400"}`}>
                {number === 1 ? "Product details" : "Delivery & review"}
              </span>
              {number === 1 && <div className="h-px flex-1 bg-black/20" />}
            </div>
          ))}
        </div>

        {step === 1 ? (
          <form onSubmit={continueToDelivery} className="space-y-7 border-2 border-black p-5 md:p-8">
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight">What are you selling?</h2>
              <p className="mt-1 text-xs text-neutral-500">Add clear details and photos so customers know exactly what to expect.</p>
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
                <input className={inputClass} type="number" min="0" step="1" value={form.stock} onChange={(e) => update("stock", e.target.value)} required />
              </label>
              <label className="flex items-end pb-3">
                <span className="flex items-center gap-3 text-sm">
                  <input type="checkbox" checked={form.negotiable} onChange={(e) => update("negotiable", e.target.checked)} className="size-4 accent-black" />
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
                  <div key={`${file.name}-${index}`} className="relative aspect-square border border-black/20">
                    <img src={previews[index]} alt={`Product photo ${index + 1}`} className="size-full object-cover" />
                    {index === 0 && <span className="absolute bottom-0 left-0 bg-black px-2 py-1 text-[9px] font-bold uppercase text-white">Cover</span>}
                    <button type="button" onClick={() => setFiles((current) => current.filter((_, i) => i !== index))} aria-label={`Remove photo ${index + 1}`} className="absolute right-1 top-1 flex size-7 items-center justify-center bg-white text-black shadow"><XIcon className="size-4" /></button>
                  </div>
                ))}
                {files.length < MAX_IMAGES && (
                  <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-black/30 text-center hover:border-black">
                    <ImagePlusIcon className="size-6" />
                    <span className="text-[10px] font-bold uppercase tracking-wide">Add photos</span>
                    <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { handleFiles(e.target.files); e.currentTarget.value = ""; }} />
                  </label>
                )}
              </div>
            </div>

            <button type="submit" className="flex w-full items-center justify-center gap-2 bg-black px-5 py-4 text-xs font-black uppercase tracking-[0.16em] text-white hover:bg-neutral-800">
              Continue to delivery <ArrowRightIcon className="size-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-7 border-2 border-black p-5 md:p-8">
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight">How will we collect and deliver it?</h2>
              <p className="mt-1 text-xs text-neutral-500">Naija Mart coordinates delivery. Choose how the item gets from you to our fulfilment network.</p>
            </div>

            <fieldset>
              <legend className={`${labelClass} mb-3`}>Getting the item to Naija Mart</legend>
              <div className="grid gap-3 md:grid-cols-2">
                {([
                  ["dropoff", "I will drop it off", "You bring the item to the Naija Mart warehouse for your state."],
                  ["pickup", "Arrange a pickup", "We arrange collection from your address before the customer delivery."],
                ] as const).map(([value, title, description]) => (
                  <label key={value} className={`cursor-pointer border-2 p-4 ${form.fulfillmentMethod === value ? "border-black bg-neutral-50" : "border-black/20"}`}>
                    <span className="flex items-start gap-3">
                      <input type="radio" name="fulfillmentMethod" value={value} checked={form.fulfillmentMethod === value} onChange={() => update("fulfillmentMethod", value)} className="mt-1 accent-black" />
                      <span><span className="block text-sm font-bold">{title}</span><span className="mt-1 block text-xs leading-5 text-neutral-500">{description}</span></span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {form.fulfillmentMethod === "pickup" && (
              <div className="grid gap-5 border-l-2 border-black pl-4 md:grid-cols-2">
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
                  <input type="checkbox" checked={form.chargesDeliveryFee} onChange={(e) => update("chargesDeliveryFee", e.target.checked)} className="size-4 accent-black" />
                  I charge an additional delivery fee
                </label>
              </div>
              {form.chargesDeliveryFee && (
                <label className="md:col-span-2">
                  <span className={labelClass}>Additional fee (₦)</span>
                  <input className={inputClass} type="number" min="0" step="1" value={form.deliveryFeeAmount} onChange={(e) => update("deliveryFeeAmount", e.target.value)} required placeholder="0" />
                  <span className="mt-1 block text-xs text-neutral-500">This amount is saved with your listing. Checkout fee calculations will be connected separately.</span>
                </label>
              )}
            </div>

            <div className="border-l-2 border-black bg-neutral-50 p-4 text-xs leading-5 text-neutral-600">
              Your listing will be sent to the Naija Mart team for review. The listing-fee payment step will be added in the next phase; no payment is taken here.
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button type="button" onClick={() => { setStep(1); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="flex items-center justify-center gap-2 border-2 border-black px-5 py-4 text-xs font-black uppercase tracking-[0.16em]">
                <ArrowLeftIcon className="size-4" /> Back to product details
              </button>
              <button type="submit" disabled={saving} className="flex items-center justify-center gap-2 bg-black px-6 py-4 text-xs font-black uppercase tracking-[0.16em] text-white disabled:opacity-60">
                {saving ? <><LoaderCircleIcon className="size-4 animate-spin" /> Uploading & submitting…</> : "Submit listing for review"}
              </button>
            </div>
          </form>
        )}
      </div>
    </PageShell>
  );
}
