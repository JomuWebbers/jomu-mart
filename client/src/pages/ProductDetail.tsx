import { useEffect, useMemo, useState, type SubmitEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Heart, ShieldCheck, ShoppingCart, Truck } from "lucide-react";
import { MicroLabel, PageShell } from "../components/wireframe-primitives";
import { fmt, pct } from "../components/wireframe-helpers";
import { apiRequest } from "../lib/api";
import { saveBuyNow } from "../lib/buyNow";
import { useAuth } from "../context/useAuth";
import { useCart } from "../context/useCart";
import { useSavedItems } from "../context/useSavedItems";

type Product = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  originalPrice?: number | null;
  image: string;
  images?: string[] | null;
  category: string;
  subcategory?: string | null;
  stock?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  sellerId: string;
  negotiable?: string | null;
  fulfillmentMethod?: string | null;
  sellerState?: string | null;
  sellerLga?: string | null;
  deliveryDays?: number | null;
  chargesDeliveryFee?: boolean | null;
  deliveryFeeAmount?: number | null;
};

type ProductReview = {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  user: { id: string; name: string; avatar?: string | null };
};

type ReviewsResponse = {
  reviews: ProductReview[];
  canReview: boolean;
  alreadyReviewed: boolean;
  myReview: { id: string; rating: number; comment: string } | null;
};

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { addToCart } = useCart();
  const { markSavedItem } = useSavedItems();
  const [productData, setProductData] = useState<Product | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState("");
  const [qty, setQty] = useState(1);
  const [productError, setProductError] = useState("");
  const [retryProduct, setRetryProduct] = useState(0);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [relatedLoadedForId, setRelatedLoadedForId] = useState<string | null>(null);
  const [relatedError, setRelatedError] = useState<{
    productId: string;
    message: string;
  } | null>(null);
  const [reviewLoadError, setReviewLoadError] = useState("");
  const [retryReviews, setRetryReviews] = useState(0);
  const [reviewData, setReviewData] = useState<
    (ReviewsResponse & { productId: string }) | null
  >(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [savedStatus, setSavedStatus] = useState<{
    productId: string;
    token: string;
    saved: boolean;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);




  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    apiRequest(`/products/${encodeURIComponent(id)}`)
      .then((data: Product) => {
        if (cancelled) return;
        setProductError("");
        setProductData(data);
        setLoadedId(id);
        setActiveImage(data.image || data.images?.[0] || "");
        setQty(1);
      })
      .catch(() => {
        if (cancelled) return;
        setProductData(null);
        setLoadedId(id);
        setProductError("We could not load this product. Please try again.");
      });

    return () => {
      cancelled = true;
    };
  }, [id, retryProduct]);

  useEffect(() => {
    if (!productData || productData.id !== id) return;

    let cancelled = false;
    apiRequest(
      `/products?category=${encodeURIComponent(productData.category)}`,
    )
      .then((items: Product[]) => {
        if (!cancelled) {
          setRelatedProducts(
            items.filter((item) => item.id !== productData.id).slice(0, 4),
          );
          setRelatedLoadedForId(productData.id);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setRelatedError(
            {
              productId: productData.id,
              message:
                error instanceof Error
                  ? error.message
                  : "Could not load related products.",
            },
          );
          setRelatedLoadedForId(productData.id);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, productData]);

  useEffect(() => {
    if (!id || !token) return;

    let cancelled = false;
    apiRequest("/wishlist", { token })
      .then((items: Product[]) => {
        if (!cancelled) {
          setSavedStatus({
            productId: id,
            token,
            saved: items.some((item) => item.id === id),
          });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Could not check saved-item status.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, token]);

  const isSaved = Boolean(
    token &&
      savedStatus?.productId === id &&
      savedStatus?.token === token &&
      savedStatus?.saved,
  );

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    apiRequest(`/products/${encodeURIComponent(id)}/reviews`, {
      token: token ?? undefined,
    })
      .then((data: ReviewsResponse) => {
        if (cancelled) return;
        setReviewLoadError("");
        setReviewData({ ...data, productId: id });
        if (data.myReview) {
          setReviewRating(data.myReview.rating);
          setReviewComment(data.myReview.comment);
        } else {
          setReviewRating(5);
          setReviewComment("");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReviewLoadError("Could not load customer reviews. Please try again.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, token, retryReviews]);

  const product = loadedId === id ? productData : null;
  const loading = Boolean(id) && loadedId !== id;
  const notFound = !id || (loadedId === id && !productData);

  const galleryImages = useMemo(() => {
    if (!product) return [];
    return Array.from(
      new Set(
        [product.image, ...(product.images ?? [])].filter(
          (url): url is string => typeof url === "string" && url.trim().length > 0,
        ),
      ),
    ).slice(0, 4);
  }, [product]);

  if (loading) {
    return (
      <div className="p-12 text-center font-bold" role="status">
        Loading product…
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="p-12 text-center" role={productError ? "alert" : undefined}>
        <p className="mb-4 font-bold">
          {productError || "This product could not be found."}
        </p>
        {productError && (
          <button
            type="button"
            onClick={() => {
              setProductError("");
              setLoadedId(null);
              setRetryProduct((attempt) => attempt + 1);
            }}
            className="mr-4 font-bold underline"
          >
            Try again
          </button>
        )}
        <Link to="/" className="font-bold underline">Back to store</Link>
      </div>
    );
  }



  const isOwnListing = user?.id === product.sellerId;
  const outOfStock = product.stock != null && product.stock <= 0;
  const maxQty = product.stock != null ? Math.max(product.stock, 1) : 99;
  const reviewCount = product.reviewCount || 0;
  const rating = product.rating || 0;
  const hasDiscount =
    product.originalPrice != null && product.originalPrice > product.price;
  const currentReviewData = reviewData?.productId === id ? reviewData : null;
  const reviews = currentReviewData?.reviews ?? [];
  const canReview = Boolean(token && currentReviewData?.canReview);
  const ratingCounts = [5, 4, 3, 2, 1].map((value) => ({
    value,
    count: reviews.filter((review) => review.rating === value).length,
  }));

  async function submitReview(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !id) {
      toast.error("Sign in to write a review.");
      return;
    }
    if (reviewComment.trim().length < 10) {
      setReviewError("Please write at least 10 characters.");
      return;
    }

    setSubmittingReview(true);
    setReviewError("");
    try {
      const result = await apiRequest(
        `/products/${encodeURIComponent(id)}/reviews`,
        {
          method: "POST",
          token,
          body: { rating: reviewRating, comment: reviewComment.trim() },
        },
      );

      const refreshed = (await apiRequest(
        `/products/${encodeURIComponent(id)}/reviews`,
        { token },
      )) as ReviewsResponse;
      setReviewData({ ...refreshed, productId: id });
      setProductData((current) =>
        current && current.id === id
          ? { ...current, rating: result.rating, reviewCount: result.reviewCount }
          : current,
      );
      toast.success("Your verified-purchase review has been saved.");
    } catch (error) {
      setReviewError(
        error instanceof Error ? error.message : "Could not submit your review.",
      );
    } finally {
      setSubmittingReview(false);
    }
  }

  function addProductToCart() {
    const currentProduct = product;
    if (!currentProduct) return;

    if (isOwnListing) {
      toast.error("You can’t purchase a listing you created.");
      return;
    }
    if (outOfStock) {
      toast.error("This product is out of stock.");
      return;
    }

    addToCart(
      {
        id: currentProduct.id,
        name: currentProduct.name,
        price: currentProduct.price,
        image: activeImage || currentProduct.image,
        sellerId: currentProduct.sellerId,
      },
      qty,
    );
    toast.success(`${currentProduct.name} added to cart`);
  }

  async function toggleSavedItem() {
    if (!token) {
      toast.error("Sign in to save items.");
      navigate("/login");
      return;
    }
    if (!product) return;

    setIsSaving(true);
    try {
      await apiRequest(`/wishlist/${encodeURIComponent(product.id)}`, {
        method: isSaved ? "DELETE" : "POST",
        token,
      });
      setSavedStatus({ productId: product.id, token, saved: !isSaved });
      markSavedItem(product.id, !isSaved);
      toast.success(
        isSaved ? "Removed from saved items" : "Added to saved items",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update saved items.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function buyNow() {
    const currentProduct = product;
    

    if (!currentProduct) return;

    if (isOwnListing) {
      toast.error("You can’t purchase a listing you created.");
      return;
    }
    if (outOfStock) {
      toast.error("This product is out of stock.");
      return;
    }
    if (!token) {
      toast.error("Sign in before placing an order.");
      navigate("/login");
      return;
    }

    const clampedQty = Math.min(
      Math.max(qty, 1),
      currentProduct.stock != null ? Math.max(currentProduct.stock, 1) : 99,
    );
    const buyNowItem = {
      id: currentProduct.id,
      name: currentProduct.name,
      price: currentProduct.price,
      image: activeImage || currentProduct.image,
      sellerId: currentProduct.sellerId,
      qty: clampedQty,
    };

    // Mirror the Buy Now in sessionStorage so a refresh on /checkout restores
    // the single item instead of silently falling back to the full cart.
    saveBuyNow(buyNowItem);

    navigate("/checkout", {
      state: {
        buyNowItem,
      },
    });
  }

  return (
    <PageShell
      title=""
      breadcrumb={`Home / ${product.category}${product.subcategory ? ` / ${product.subcategory}` : ""} / ${product.name}`}
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        <section className="lg:col-span-6">
          <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
            {hasDiscount && (
              <span className="absolute left-3 top-3 z-10 rounded bg-[#E63312] px-3 py-1.5 text-xs font-bold text-white">
                Save {pct(product.price, product.originalPrice!)}%
              </span>
            )}
            {activeImage ? (
              <img
                src={activeImage}
                alt={product.name}
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="text-xs font-bold uppercase text-neutral-400">
                No product image
              </span>
            )}
          </div>

          {galleryImages.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {galleryImages.map((image, index) => (
              <button
                key={`${image}-${index}`}
                type="button"
                onClick={() => setActiveImage(image)}
                aria-label={`Show product image ${index + 1}`}
                aria-pressed={activeImage === image}
                className={`aspect-square overflow-hidden rounded border-2 bg-neutral-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E63312] ${
                  activeImage === image ? "border-[#E63312]" : "border-neutral-200"
                }`}
              >
                <img
                  src={image}
                  alt={`${product.name}, image ${index + 1}`}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
            </div>
          )}
          {galleryImages.length === 1 && (
            <p className="mt-2 text-center text-xs text-neutral-500">
              1 product image
            </p>
          )}
          {galleryImages.length === 0 && (
            <p className="mt-2 text-center text-xs text-neutral-500">
              Product image unavailable
            </p>
          )}
        </section>

        <section className="flex flex-col rounded-lg border border-neutral-200 bg-white p-4 sm:p-6 lg:col-span-6">
          <MicroLabel>
            {product.category}{product.subcategory ? ` / ${product.subcategory}` : ""}
          </MicroLabel>
          <div className="mt-2 flex items-start justify-between gap-4">
            <h1 className="text-xl font-bold leading-tight text-neutral-950 sm:text-2xl">
              {product.name}
            </h1>
            <button
              type="button"
              onClick={() => void toggleSavedItem()}
              disabled={isSaving}
              aria-label={
                isSaved ? "Remove from saved items" : "Save item"
              }
              aria-pressed={isSaved}
              className="shrink-0 rounded-full border border-neutral-200 p-3 text-neutral-700 transition-colors hover:border-[#E63312] hover:text-[#E63312] disabled:opacity-50"
            >
              <Heart
                className={`h-5 w-5 ${isSaved ? "fill-[#E63312] text-[#E63312]" : ""}`}
              />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            {reviewCount > 0 ? (
              <>
                <span className="font-bold text-amber-500" aria-label={`${rating} out of 5 stars`}>
                  {"★".repeat(Math.max(0, Math.min(5, Math.round(rating))))}
                  {"☆".repeat(5 - Math.max(0, Math.min(5, Math.round(rating))))}
                </span>
                <span className="font-bold">{rating.toFixed(1)}</span>
                <a href="#reviews" className="text-neutral-500 underline underline-offset-2">
                  ({reviewCount} ratings)
                </a>
              </>
            ) : (
              <span className="text-neutral-500">No ratings yet</span>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-black text-neutral-950">{fmt(product.price)}</span>
            {hasDiscount && (
              <>
                <span className="text-sm text-neutral-500 line-through">
                  {fmt(product.originalPrice!)}
                </span>
                <span className="rounded bg-red-50 px-2 py-1 text-xs font-bold text-[#E63312]">
                  Save {fmt(product.originalPrice! - product.price)} ({pct(product.price, product.originalPrice!)}%)
                </span>
              </>
            )}
          </div>
          {product.negotiable === "yes" && (
            <p className="mt-2 text-sm font-semibold">Price is negotiable</p>
          )}

          <div className="mt-5 rounded-lg bg-neutral-50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Truck className="h-5 w-5 text-[#E63312]" />
              <h2 className="font-bold">Delivery &amp; fulfilment</h2>
            </div>
            <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-neutral-600">Availability</span>
              <span className={`text-sm font-bold ${outOfStock ? "text-red-600" : "text-green-700"}`}>
                {outOfStock ? "Out of stock" : product.stock == null ? "Available" : `${product.stock} available`}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="text-sm text-neutral-600">Ships from</span>
              <span className="text-right text-sm font-semibold">
                {[product.sellerLga, product.sellerState].filter(Boolean).join(", ") || "Location provided after order"}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="text-sm text-neutral-600">Fulfilment</span>
              <span className="text-right text-sm font-semibold">
                {product.fulfillmentMethod === "pickup" ? "Pickup from seller" : "Seller delivery"}
              </span>
            </div>
            {product.deliveryDays != null && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-neutral-600">Estimated delivery</span>
                <span className="text-sm font-semibold">About {product.deliveryDays} day{product.deliveryDays === 1 ? "" : "s"}</span>
              </div>
            )}
            {product.chargesDeliveryFee && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-neutral-600">Seller delivery fee</span>
                <span className="text-sm font-semibold">{fmt(product.deliveryFeeAmount || 0)}</span>
              </div>
            )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 py-5">
            <span className="text-sm font-semibold">Quantity</span>
            <div className="flex items-center rounded border border-neutral-300">
              <button
                type="button"
                onClick={() => setQty((current) => Math.max(1, current - 1))}
                disabled={qty <= 1}
                aria-label="Decrease quantity"
                className="px-4 py-2.5 font-bold hover:text-[#E63312] disabled:opacity-40"
              >−</button>
              <span className="min-w-12 border-x border-neutral-300 px-4 py-2.5 text-center font-bold">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((current) => Math.min(maxQty, current + 1))}
                disabled={qty >= maxQty}
                aria-label="Increase quantity"
                className="px-4 py-2.5 font-bold hover:text-[#E63312] disabled:opacity-40"
              >+</button>
            </div>
          </div>

          {isOwnListing && (
            <p className="mb-4 border-l-4 border-amber-500 bg-amber-50 p-3 text-sm">
              This is your listing. You can view it, but you can’t buy it.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={addProductToCart}
              disabled={isOwnListing || outOfStock}
              className="flex items-center justify-center gap-2 rounded border border-black py-3.5 text-sm font-bold transition-colors hover:border-[#E63312] hover:text-[#E63312] disabled:cursor-not-allowed disabled:opacity-40"
            ><ShoppingCart className="h-4 w-4" /> Add to Cart</button>
            <button
              type="button"
              onClick={buyNow}
              disabled={isOwnListing || outOfStock}
              className="rounded bg-[#E63312] py-3.5 text-sm font-bold transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
            >Buy Now</button>
          </div>

          <div className="mt-5 flex items-center gap-2 border-t border-neutral-200 pt-4 text-xs text-neutral-600">
            <ShieldCheck className="h-4 w-4 shrink-0 text-green-700" />
            <span>Secure checkout · Order tracking · Customer support</span>
          </div>
        </section>
      </div>

      <nav
        aria-label="Product information"
        className="sticky top-0 z-20 mt-10 flex gap-6 overflow-x-auto border-b border-neutral-200 bg-white px-1"
      >
        {[
          { label: "Product details", href: "#description" },
          { label: "Specifications", href: "#specifications" },
          { label: `Customer reviews (${reviewCount})`, href: "#reviews" },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="shrink-0 border-b-2 border-transparent py-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-[#E63312] hover:text-[#E63312]"
          >
            {item.label}
          </a>
        ))}
      </nav>

      <section className="grid gap-8 border-b border-neutral-200 py-8 lg:grid-cols-3">
        <div id="description" className="scroll-mt-20 lg:col-span-2">
          <h2 className="text-lg font-bold">Product description</h2>
          <div className="mt-3 whitespace-pre-line text-sm leading-7 text-neutral-700">
            {product.description?.trim() || "The seller has not added a description yet."}
          </div>
        </div>
        <div id="specifications" className="scroll-mt-20 rounded-lg border border-neutral-200 p-5">
          <h2 className="text-lg font-bold">Specifications</h2>
          <dl className="mt-4 divide-y divide-neutral-100 text-sm">
            <div className="flex justify-between gap-3 py-3">
              <dt className="text-neutral-500">Category</dt>
              <dd className="text-right font-semibold">{product.category}</dd>
            </div>
            {product.subcategory && (
              <div className="flex justify-between gap-3 py-3">
                <dt className="text-neutral-500">Subcategory</dt>
                <dd className="text-right font-semibold">{product.subcategory}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3 py-3">
              <dt className="text-neutral-500">Price type</dt>
              <dd className="text-right font-semibold">{product.negotiable === "yes" ? "Negotiable" : "Fixed"}</dd>
            </div>
            <div className="flex justify-between gap-3 py-3">
              <dt className="text-neutral-500">Fulfilment</dt>
              <dd className="text-right font-semibold">{product.fulfillmentMethod === "pickup" ? "Pickup" : "Seller delivery"}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section id="reviews" className="scroll-mt-20 border-b border-neutral-200 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Customer reviews</h2>
            <p className="mt-1 text-sm text-neutral-600">
              {reviewCount > 0
                ? `${rating.toFixed(1)} out of 5 from ${reviewCount} rating${reviewCount === 1 ? "" : "s"}`
                : "No ratings yet"}
            </p>
          </div>
          {reviewCount > 0 && (
            <div className="text-3xl font-bold text-neutral-950">
              {rating.toFixed(1)}
              <span className="ml-1 text-base font-normal text-neutral-500">/ 5</span>
            </div>
          )}
        </div>
        {reviewLoadError && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
            <span>{reviewLoadError}</span>
            <button
              type="button"
              onClick={() => setRetryReviews((attempt) => attempt + 1)}
              className="font-bold underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        )}
        {reviewCount > 0 && reviews.length > 0 && (
          <div className="mt-6 max-w-xl space-y-2">
            {ratingCounts.map(({ value, count }) => (
              <div key={value} className="grid grid-cols-[3rem_1fr_2rem] items-center gap-3 text-xs text-neutral-600">
                <span>{value} star</span>
                <div className="h-2 overflow-hidden rounded bg-neutral-100">
                  <div
                    className="h-full rounded bg-amber-400"
                    style={{ width: `${(count / reviews.length) * 100}%` }}
                  />
                </div>
                <span className="text-right">{count}</span>
              </div>
            ))}
            {reviews.length < reviewCount && (
              <p className="pt-1 text-xs text-neutral-500">
                Showing the latest {reviews.length} reviews.
              </p>
            )}
          </div>
        )}
        {token && canReview ? (
          <form onSubmit={submitReview} className="mt-5 rounded-lg border border-neutral-200 p-5">
            <h3 className="font-bold">
              {currentReviewData?.alreadyReviewed ? "Update your review" : "Review this product"}
            </h3>
            <p className="mt-1 text-xs text-neutral-500">
              Reviews are available after an order containing this product is delivered.
            </p>
            <div className="mt-4">
              <label className="block text-xs font-bold uppercase tracking-widest">
                Your rating
              </label>
              <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Product rating">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={reviewRating === value}
                    aria-label={`${value} star${value === 1 ? "" : "s"}`}
                    onClick={() => setReviewRating(value)}
                    className={`text-2xl ${value <= reviewRating ? "text-amber-500" : "text-neutral-300"}`}
                  >★</button>
                ))}
              </div>
            </div>
            <label
              htmlFor="product-review-comment"
              className="mt-4 block text-xs font-bold uppercase tracking-widest"
            >
              Your review
            </label>
            <textarea
              id="product-review-comment"
              value={reviewComment}
              onChange={(event) => setReviewComment(event.target.value)}
              minLength={10}
              maxLength={1500}
              required
              rows={5}
              placeholder="Share your experience with this product…"
              className="mt-2 w-full rounded border border-neutral-300 p-3 text-sm outline-none focus:border-[#E63312] focus:ring-1 focus:ring-[#E63312]"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-neutral-500">
                {reviewComment.length}/1500 characters
              </span>
              <button
                type="submit"
                disabled={submittingReview}
                className="rounded bg-[#E63312] px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-black disabled:opacity-50"
              >
                {submittingReview ? "Saving…" : "Submit review"}
              </button>
            </div>
            {reviewError && (
              <p role="alert" className="mt-3 text-sm font-semibold text-red-600">
                {reviewError}
              </p>
            )}
          </form>
        ) : !token ? (
          <p className="mt-4 rounded border border-neutral-200 p-5 text-sm text-neutral-600">
            <Link to="/login" className="font-bold underline">Sign in</Link> and
            complete delivery of this product to leave a verified review.
          </p>
        ) : (
          <p className="mt-4 rounded border border-neutral-200 p-5 text-sm text-neutral-600">
            Reviews are open to customers after an order containing this product is marked delivered.
          </p>
        )}

        <div className="mt-6 space-y-3">
          {reviews.map((review) => (
            <article key={review.id} className="rounded-lg border border-neutral-200 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{review.user.name}</p>
                  <p className="mt-1 text-amber-600" aria-label={`${review.rating} out of 5 stars`}>
                    {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-green-700">
                    Verified purchase
                  </span>
                  <p className="mt-1 text-xs text-neutral-500">
                    {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(
                      new Date(review.createdAt),
                    )}
                  </p>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-neutral-700">
                {review.comment}
              </p>
            </article>
          ))}
          {currentReviewData && reviews.length === 0 && !reviewLoadError && (
            <p className="rounded border border-neutral-200 p-5 text-sm text-neutral-600">
              There are no customer reviews for this product yet.
            </p>
          )}
        </div>
      </section>

      <section className="py-10">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <MicroLabel>{product.category}</MicroLabel>
            <h2 className="mt-1 text-xl font-bold">Customers also viewed</h2>
          </div>
          <Link
            to={`/?q=${encodeURIComponent(product.category)}`}
            className="shrink-0 text-sm font-semibold text-[#E63312] hover:underline"
          >
            See all
          </Link>
        </div>
        {relatedError?.productId === product.id ? (
          <p className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
            {relatedError.message}
          </p>
        ) : relatedLoadedForId !== product.id ? (
          <p className="text-sm text-neutral-500" role="status">
            Loading related products…
          </p>
        ) : relatedProducts.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {relatedProducts.map((related) => {
              const hasRelatedDiscount =
                related.originalPrice != null &&
                related.originalPrice > related.price;
              return (
                <Link
                  key={related.id}
                  to={`/products/${related.id}`}
                  className="group overflow-hidden rounded-lg border border-neutral-200 bg-white transition-shadow hover:shadow-md"
                >
                  <div className="aspect-square overflow-hidden bg-neutral-100">
                    {related.image ? (
                      <img
                        src={related.image}
                        alt={related.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-neutral-400">
                        Image unavailable
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-2 min-h-10 text-sm font-medium group-hover:text-[#E63312]">
                      {related.name}
                    </p>
                    <div className="mt-2 flex flex-wrap items-baseline gap-2">
                      <span className="font-bold">{fmt(related.price)}</span>
                      {hasRelatedDiscount && (
                        <span className="text-xs text-neutral-500 line-through">
                          {fmt(related.originalPrice!)}
                        </span>
                      )}
                    </div>
                    {related.rating != null && related.rating > 0 && (
                      <p className="mt-2 text-xs text-neutral-600">
                        <span className="text-amber-500">★</span>{" "}
                        {related.rating.toFixed(1)} ({related.reviewCount ?? 0})
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          relatedError?.productId !== product.id && (
            <p className="text-sm text-neutral-500">
              {relatedProducts.length === 0
                ? "No related products are available right now."
                : ""}
            </p>
          )
        )}
      </section>
    </PageShell>
  );
}
