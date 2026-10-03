import { useEffect, useMemo, useState, type SubmitEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Divider, MicroLabel, PageShell } from "../components/wireframe-primitives";
import { fmt, pct } from "../components/wireframe-helpers";
import { apiRequest } from "../lib/api";
import { saveBuyNow } from "../lib/buyNow";
import { useAuth } from "../context/useAuth";
import { useCart } from "../context/useCart";

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
  const [productData, setProductData] = useState<Product | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState("");
  const [qty, setQty] = useState(1);
  const [reviewData, setReviewData] = useState<
    (ReviewsResponse & { productId: string }) | null
  >(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");




  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    apiRequest(`/products/${encodeURIComponent(id)}`)
      .then((data: Product) => {
        if (cancelled) return;
        setProductData(data);
        setLoadedId(id);
        setActiveImage(data.image || data.images?.[0] || "");
        setQty(1);
      })
      .catch(() => {
        if (cancelled) return;
        setProductData(null);
        setLoadedId(id);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    apiRequest(`/products/${encodeURIComponent(id)}/reviews`, {
      token: token ?? undefined,
    })
      .then((data: ReviewsResponse) => {
        if (cancelled) return;
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
          setReviewData({
            productId: id,
            reviews: [],
            canReview: false,
            alreadyReviewed: false,
            myReview: null,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, token]);

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
    return <div className="p-12 text-center font-bold">Loading product…</div>;
  }

  if (notFound || !product) {
    return (
      <div className="p-12 text-center">
        <p className="mb-4 font-bold">This product could not be found.</p>
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
      breadcrumb={`Home / ${product.category}${product.subcategory ? ` / ${product.subcategory}` : ""}`}
    >
      <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
        <section className="md:col-span-6">
          <div className="flex h-80 items-center justify-center overflow-hidden bg-neutral-100 md:h-[480px]">
            {activeImage ? (
              <img
                src={activeImage}
                alt={product.name}
                className="h-full w-full object-initial"
              />
            ) : (
              <span className="text-xs font-bold uppercase text-neutral-400">
                No product image
              </span>
            )}
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2">
            {galleryImages.map((image, index) => (
              <button
                key={`${image}-${index}`}
                type="button"
                onClick={() => setActiveImage(image)}
                aria-label={`Show product image ${index + 1}`}
                aria-pressed={activeImage === image}
                className={`h-16 overflow-hidden border-2 bg-neutral-100 md:h-20 ${
                  activeImage === image ? "border-black" : "border-black/15"
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
        </section>

        <section className="flex flex-col md:col-span-6">
          <MicroLabel>
            {product.category}{product.subcategory ? ` / ${product.subcategory}` : ""}
          </MicroLabel>
          <h1 className="mt-2 text-2xl font-black uppercase leading-tight md:text-3xl">
            {product.name}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            {reviewCount > 0 ? (
              <>
                <span className="font-bold" aria-label={`${rating} out of 5 stars`}>
                  {"★".repeat(Math.max(0, Math.min(5, Math.round(rating))))}
                  {"☆".repeat(5 - Math.max(0, Math.min(5, Math.round(rating))))}
                </span>
                <span className="font-bold">{rating.toFixed(1)}</span>
                <a href="#reviews" className="text-neutral-500 underline">
                  ({reviewCount} ratings)
                </a>
              </>
            ) : (
              <span className="text-neutral-500">No ratings yet</span>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-black">{fmt(product.price)}</span>
            {hasDiscount && (
              <>
                <span className="text-sm text-neutral-400 line-through">
                  {fmt(product.originalPrice!)}
                </span>
                <span className="bg-black px-2 py-1 text-[10px] font-black text-white">
                  -{pct(product.price, product.originalPrice!)}%
                </span>
              </>
            )}
          </div>
          {product.negotiable === "yes" && (
            <p className="mt-2 text-sm font-semibold">Price is negotiable</p>
          )}

          <Divider />
          <div className="space-y-4 py-5">
            <div className="flex items-center justify-between gap-4">
              <MicroLabel>Availability</MicroLabel>
              <span className={`text-sm font-bold ${outOfStock ? "text-red-600" : "text-green-700"}`}>
                {outOfStock ? "Out of stock" : product.stock == null ? "Available" : `${product.stock} available`}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <MicroLabel>Seller location</MicroLabel>
              <span className="text-right text-sm font-semibold">
                {[product.sellerLga, product.sellerState].filter(Boolean).join(", ") || "Location provided after order"}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <MicroLabel>Fulfillment</MicroLabel>
              <span className="text-right text-sm font-semibold">
                {product.fulfillmentMethod === "pickup" ? "Pickup from seller" : "Seller delivery"}
              </span>
            </div>
            {product.deliveryDays != null && (
              <div className="flex items-center justify-between gap-4">
                <MicroLabel>Delivery estimate</MicroLabel>
                <span className="text-sm font-semibold">About {product.deliveryDays} day{product.deliveryDays === 1 ? "" : "s"}</span>
              </div>
            )}
            {product.chargesDeliveryFee && (
              <div className="flex items-center justify-between gap-4">
                <MicroLabel>Seller delivery fee</MicroLabel>
                <span className="text-sm font-semibold">{fmt(product.deliveryFeeAmount || 0)}</span>
              </div>
            )}
          </div>

          <Divider />
          <div className="flex flex-wrap items-center gap-4 py-5">
            <MicroLabel>Quantity</MicroLabel>
            <div className="flex items-center border-2 border-black">
              <button
                type="button"
                onClick={() => setQty((current) => Math.max(1, current - 1))}
                disabled={qty <= 1}
                aria-label="Decrease quantity"
                className="px-4 py-3 font-black disabled:opacity-40"
              >−</button>
              <span className="min-w-12 border-x-2 border-black px-4 py-3 text-center font-bold">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((current) => Math.min(maxQty, current + 1))}
                disabled={qty >= maxQty}
                aria-label="Increase quantity"
                className="px-4 py-3 font-black disabled:opacity-40"
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
              className="border-2 border-black py-4 text-xs font-black uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-40"
            >Add to Cart</button>
            <button
              type="button"
              onClick={buyNow}
              disabled={isOwnListing || outOfStock}
              className="bg-[var(--vermilion)] py-4 text-xs font-black uppercase tracking-widest text-white disabled:cursor-not-allowed disabled:opacity-40"
            >Buy Now</button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-black/15 pt-5 text-center">
            {["Secure checkout", "Order tracking", "Customer support"].map((label) => (
              <span key={label} className="text-[10px] font-bold uppercase text-neutral-500">{label}</span>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-12 grid gap-8 border-t-2 border-black pt-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="text-lg font-black uppercase">Product description</h2>
          <div className="mt-3 whitespace-pre-line text-sm leading-7 text-neutral-700">
            {product.description?.trim() || "The seller has not added a description yet."}
          </div>
        </div>
        <div className="border-2 border-black p-5">
          <MicroLabel>Listing details</MicroLabel>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-neutral-500">Category</dt>
              <dd className="text-right font-semibold">{product.category}</dd>
            </div>
            {product.subcategory && (
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">Subcategory</dt>
                <dd className="text-right font-semibold">{product.subcategory}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-neutral-500">Price type</dt>
              <dd className="text-right font-semibold">{product.negotiable === "yes" ? "Negotiable" : "Fixed"}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section id="reviews" className="mt-12 scroll-mt-8 border-t-2 border-black pt-8">
        <h2 className="text-lg font-black uppercase">Customer reviews</h2>
        {reviewCount > 0 && (
          <p className="mt-1 text-sm text-neutral-600">
            Average rating: {rating.toFixed(1)} out of 5 from {reviewCount} rating{reviewCount === 1 ? "" : "s"}.
          </p>
        )}
        {token && canReview ? (
          <form onSubmit={submitReview} className="mt-5 border-2 border-black p-5">
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
              className="mt-2 w-full border-2 border-black p-3 text-sm outline-none"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-neutral-500">
                {reviewComment.length}/1500 characters
              </span>
              <button
                type="submit"
                disabled={submittingReview}
                className="bg-black px-5 py-3 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50"
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
          <p className="mt-4 border border-black/15 p-5 text-sm text-neutral-600">
            <Link to="/login" className="font-bold underline">Sign in</Link> and
            complete delivery of this product to leave a verified review.
          </p>
        ) : (
          <p className="mt-4 border border-black/15 p-5 text-sm text-neutral-600">
            Reviews are open to customers after an order containing this product is marked delivered.
          </p>
        )}

        <div className="mt-6 space-y-3">
          {reviews.map((review) => (
            <article key={review.id} className="border border-black/15 p-5">
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
          {currentReviewData && reviews.length === 0 && (
            <p className="border border-black/15 p-5 text-sm text-neutral-600">
              There are no customer reviews for this product yet.
            </p>
          )}
        </div>
      </section>
    </PageShell>
  );
}
