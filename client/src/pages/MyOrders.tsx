import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { apiRequest } from "../lib/api";
import { fmt } from "../components/wireframe-helpers";
import { MicroLabel, Wire } from "../components/wireframe-primitives";
import RequestReturnModal from "../components/RequestReturnModal";

type ReturnStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "item_picked_up"
  | "refunded";

type OrderItem = {
  productId?: string;
  name?: string;
  qty?: number;
  price?: number;
  image?: string;
};

type ReturnRequestData = {
  id: string;
  orderId?: string;
  status: ReturnStatus;
  reason: string;
  comments?: string;
  images?: string[];
  refundAmount: number;
  refundMethod?: string;
  adminNote?: string;
  createdAt: string;
  order?: {
    id: string;
    items: OrderItem[];
    total: number;
    status: string;
    createdAt: string;
  } | null;
};

type Order = {
  id: string;
  total: number;
  status: string;
  createdAt: string;
  items: OrderItem[];
  statusHistory?: { status: string; at: string }[];
  returnRequests?: ReturnRequestData[];
};

type Tab = "orders" | "returns";

// Delivered orders can be returned within this many days.
const RETURN_WINDOW_DAYS = 7;

// A return in one of these states blocks a second request for the same order.
const OPEN_RETURN_STATUSES: ReturnStatus[] = [
  "pending",
  "approved",
  "item_picked_up",
];

const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  item_picked_up: "Item picked up",
  refunded: "Refunded",
  rejected: "Rejected",
};

const RETURN_STATUS_STYLES: Record<ReturnStatus, string> = {
  pending: "border-amber-600 bg-amber-100 text-amber-800",
  approved: "border-blue-600 bg-blue-100 text-blue-800",
  item_picked_up: "border-purple-600 bg-purple-100 text-purple-800",
  refunded: "border-emerald-600 bg-emerald-100 text-emerald-800",
  rejected: "border-red-600 bg-red-100 text-red-800",
};

const REFUND_METHOD_LABELS: Record<string, string> = {
  wallet: "Store wallet",
  bank: "Bank account",
  original_payment: "Original payment method",
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const itemLabel = (item: OrderItem) => item.name || "Item";

function deliveredAt(order: Order) {
  return (
    order.statusHistory?.find((entry) => entry.status === "Delivered")?.at ??
    null
  );
}

function openReturn(order: Order) {
  return (order.returnRequests ?? []).find((request) =>
    OPEN_RETURN_STATUSES.includes(request.status),
  );
}

function returnWindow(order: Order) {
  const delivered = deliveredAt(order);
  if (!delivered) return { expired: false, daysLeft: null as number | null };

  const daysSince =
    (Date.now() - new Date(delivered).getTime()) / (24 * 60 * 60 * 1000);
  const daysLeft = Math.ceil(RETURN_WINDOW_DAYS - daysSince);

  return { expired: daysLeft <= 0, daysLeft: Math.max(daysLeft, 0) };
}
function shortId(id: string) {
  return id.slice(-8).toUpperCase();
}

function refundMethodLabel(method?: string) {
  if (!method) return "Not specified";
  return REFUND_METHOD_LABELS[method] ?? method.replaceAll("_", " ");
}

export default function MyOrders() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [returns, setReturns] = useState<ReturnRequestData[] | null>(null);
  const [loading, setLoading] = useState(() => Boolean(token));
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedOrderForReturn, setSelectedOrderForReturn] =
    useState<Order | null>(null);

  // The active tab lives in the URL so /my-orders?tab=returns can be linked to.
  const activeTab: Tab =
    searchParams.get("tab") === "returns" ? "returns" : "orders";

  const setActiveTab = useCallback(
    (tab: Tab) => {
      setSearchParams(tab === "returns" ? { tab: "returns" } : {}, {
        replace: true,
      });
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    // Returns are fetched separately for the extra detail (comments, refund
    // method, admin note). If that call fails, the return details embedded on
    // each order are still shown so the tab never comes up empty by surprise.
    // Loading and error state are only touched from the async callbacks below
    // (or from refresh()), never synchronously in this effect body.
    Promise.all([
      apiRequest("/orders/my-orders", { token }),
      apiRequest("/returns/my-returns", { token }).catch(() => null),
    ])
      .then(([ordersData, returnsData]) => {
        if (cancelled) return;
        setOrders((ordersData as Order[]) ?? []);
        setReturns((returnsData as ReturnRequestData[] | null) ?? null);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Could not load your orders",
        );
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, reloadKey]);

  // Refetches after a return is submitted. Resetting loading/error here (an
  // event callback) keeps the fetch effect free of synchronous setState calls.
  const refresh = useCallback(() => {
    setError("");
    setLoading(true);
    setReloadKey((key) => key + 1);
  }, []);

  const returnRecords = useMemo<ReturnRequestData[]>(() => {
    if (returns) return returns;

    return orders.flatMap((order) =>
      (order.returnRequests ?? []).map((request) => ({
        ...request,
        orderId: order.id,
        order: {
          id: order.id,
          items: order.items,
          total: order.total,
          status: order.status,
          createdAt: order.createdAt,
        },
      })),
    );
  }, [orders, returns]);

  async function copyOrderId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(""), 2000);
    } catch {
      setError(
        "Could not copy the order ID. You can select and copy it manually.",
      );
    }
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <div className="border-2 border-black p-8 text-center">
          <h1 className="text-xl font-black uppercase">Returns &amp; Orders</h1>
          <p className="mt-3 text-sm text-neutral-600">
            Sign in to view your orders, track deliveries and manage returns.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-block bg-black px-5 py-4 text-xs font-bold uppercase tracking-widest text-white"
          >
            Sign In
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 md:px-8">
      <MicroLabel>Account / Purchases</MicroLabel>
      <h1 className="mt-2 text-3xl font-black uppercase tracking-tight">
        Returns &amp; Orders
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600">
        Track deliveries and request a return within {RETURN_WINDOW_DAYS} days
        of delivery.
      </p>

      <div className="mt-6 flex border-2 border-black">
        {(["orders", "returns"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-3 text-xs font-bold uppercase tracking-widest ${
              activeTab === tab ? "bg-black text-white" : "bg-white"
            }`}
          >
            {tab === "orders"
              ? `Orders (${orders.length})`
              : `Returns (${returnRecords.length})`}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-4 border-2 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {loading ? (
        <div className="mt-6 space-y-4">
          {[0, 1].map((index) => (
            <Wire key={index} h="h-36" label="Loading" />
          ))}
        </div>
      ) : activeTab === "orders" ? (
        <OrdersPanel
          orders={orders}
          copiedId={copiedId}
          onCopy={(id) => void copyOrderId(id)}
          onRequestReturn={setSelectedOrderForReturn}
        />
      ) : (
        <ReturnsPanel
          records={returnRecords}
          onViewOrders={() => setActiveTab("orders")}
        />
      )}

      {selectedOrderForReturn && (
        <RequestReturnModal
          order={selectedOrderForReturn}
          token={token}
          onClose={() => setSelectedOrderForReturn(null)}
          onSuccess={() => {
            setSelectedOrderForReturn(null);
            setActiveTab("returns");
            refresh();
          }}
        />
      )}
    </main>
  );
}

function OrdersPanel({
  orders,
  copiedId,
  onCopy,
  onRequestReturn,
}: {
  orders: Order[];
  copiedId: string;
  onCopy: (id: string) => void;
  onRequestReturn: (order: Order) => void;
}) {
  if (orders.length === 0) {
    return (
      <section className="mt-6 border-2 border-black p-8 text-center">
        <p className="font-bold uppercase">No orders yet</p>
        <Link
          to="/"
          className="mt-4 inline-block bg-black px-5 py-3 text-xs font-bold uppercase tracking-widest text-white"
        >
          Start shopping
        </Link>
      </section>
    );
  }

  return (
    <section className="mt-6 space-y-4">
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          copied={copiedId === order.id}
          onCopy={() => onCopy(order.id)}
          onRequestReturn={() => onRequestReturn(order)}
        />
      ))}
    </section>
  );
}

function OrderCard({
  order,
  copied,
  onCopy,
  onRequestReturn,
}: {
  order: Order;
  copied: boolean;
  onCopy: () => void;
  onRequestReturn: () => void;
}) {
  const activeReturn = openReturn(order);
  const windowState = returnWindow(order);
  const delivered = deliveredAt(order);
  const canReturn =
    order.status === "Delivered" && !activeReturn && !windowState.expired;

  return (
    <article className="border-2 border-black p-4">
      <OrderCardHeader order={order} />
      <OrderItemList order={order} />
      <OrderCardActions
        orderId={order.id}
        copied={copied}
        canReturn={canReturn}
        daysLeft={windowState.daysLeft}
        onCopy={onCopy}
        onRequestReturn={onRequestReturn}
      />
      <OrderReturnNote
        status={order.status}
        activeReturn={activeReturn}
        expired={windowState.expired}
        delivered={delivered}
      />
    </article>
  );
}

function OrderCardHeader({ order }: { order: Order }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <MicroLabel>Order #{shortId(order.id)}</MicroLabel>
        <p className="mt-1 break-all font-mono text-xs text-neutral-600">
          {order.id}
        </p>
        <p className="mt-2 text-sm text-neutral-600">
          Placed {formatDateTime(order.createdAt)}
        </p>
      </div>
      <div className="text-right">
        <p className="text-lg font-black">{fmt(order.total)}</p>
        <span className="mt-1 inline-block border border-black px-2 py-1 text-[10px] font-bold uppercase">
          {order.status}
        </span>
      </div>
    </div>
  );
}

function OrderItemList({ order }: { order: Order }) {
  return (
    <ul className="mt-4 divide-y divide-black/10 border-y border-black/10">
      {order.items.map((item, index) => (
        <li
          key={`${order.id}-${item.productId ?? index}`}
          className="flex items-center justify-between gap-3 py-2 text-sm"
        >
          <span>
            {itemLabel(item)} × {item.qty ?? 1}
          </span>
          {typeof item.price === "number" && (
            <span className="font-bold">{fmt(item.price * (item.qty ?? 1))}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function OrderCardActions({
  orderId,
  copied,
  canReturn,
  daysLeft,
  onCopy,
  onRequestReturn,
}: {
  orderId: string;
  copied: boolean;
  canReturn: boolean;
  daysLeft: number | null;
  onCopy: () => void;
  onRequestReturn: () => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <Link
        to={`/track/${encodeURIComponent(orderId)}`}
        className="border-2 border-black px-3 py-2 text-xs font-bold uppercase"
      >
        Track
      </Link>
      <button
        type="button"
        onClick={onCopy}
        className="border-2 border-black px-3 py-2 text-xs font-bold uppercase"
      >
        {copied ? "Copied" : "Copy ID"}
      </button>
      {canReturn && (
        <button
          type="button"
          onClick={onRequestReturn}
          className="bg-black px-3 py-2 text-xs font-bold uppercase text-white"
        >
          Request return{daysLeft !== null ? ` · ${daysLeft}d left` : ""}
        </button>
      )}
    </div>
  );
}

function OrderReturnNote({
  status,
  activeReturn,
  expired,
  delivered,
}: {
  status: string;
  activeReturn?: ReturnRequestData;
  expired: boolean;
  delivered: string | null;
}) {
  if (activeReturn) {
    return (
      <p className="mt-3 text-xs text-neutral-600">
        Return in progress: {RETURN_STATUS_LABELS[activeReturn.status]}
      </p>
    );
  }

  if (status === "Delivered" && expired) {
    return (
      <p className="mt-3 text-xs text-neutral-500">
        Return window closed
        {delivered ? ` on ${formatDateTime(delivered)}` : ""}.
      </p>
    );
  }

  if (status !== "Delivered") {
    return (
      <p className="mt-3 text-xs text-neutral-500">
        Returns open after the order is delivered.
      </p>
    );
  }

  return null;
}

function ReturnsPanel({
  records,
  onViewOrders,
}: {
  records: ReturnRequestData[];
  onViewOrders: () => void;
}) {
  if (records.length === 0) {
    return (
      <section className="mt-6 border-2 border-black p-8 text-center">
        <p className="font-bold uppercase">No return requests</p>
        <p className="mt-2 text-sm text-neutral-600">
          Delivered orders can be returned within {RETURN_WINDOW_DAYS} days.
        </p>
        <button
          type="button"
          onClick={onViewOrders}
          className="mt-4 border-2 border-black px-5 py-3 text-xs font-bold uppercase tracking-widest"
        >
          View orders
        </button>
      </section>
    );
  }

  return (
    <section className="mt-6 space-y-4">
      {records.map((request) => (
        <ReturnCard key={request.id} request={request} />
      ))}
    </section>
  );
}

function ReturnCard({ request }: { request: ReturnRequestData }) {
  const relatedOrder = request.order;
  const items = relatedOrder?.items ?? [];

  return (
    <article className="border-2 border-black p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <MicroLabel>Return #{shortId(request.id)}</MicroLabel>
          <p className="mt-1 text-sm font-bold">{request.reason}</p>
          <p className="mt-1 text-xs text-neutral-600">
            Submitted {formatDateTime(request.createdAt)}
          </p>
        </div>
        <span
          className={`border px-2 py-1 text-[10px] font-bold uppercase ${RETURN_STATUS_STYLES[request.status]}`}
        >
          {RETURN_STATUS_LABELS[request.status]}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
            Refund amount
          </dt>
          <dd className="font-black">{fmt(request.refundAmount)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
            Refund method
          </dt>
          <dd>{refundMethodLabel(request.refundMethod)}</dd>
        </div>
      </dl>

      {relatedOrder && (
        <p className="mt-3 text-xs text-neutral-600">
          Order{" "}
          <Link
            to={`/track/${encodeURIComponent(relatedOrder.id)}`}
            className="break-all font-mono underline"
          >
            {shortId(relatedOrder.id)}
          </Link>{" "}
          · {fmt(relatedOrder.total)}
        </p>
      )}

      {items.length > 0 && (
        <p className="mt-2 text-sm text-neutral-700">
          {items.map((item) => `${itemLabel(item)} × ${item.qty ?? 1}`).join(", ")}
        </p>
      )}

      {request.comments && (
        <p className="mt-3 text-sm text-neutral-600">{request.comments}</p>
      )}

      {request.adminNote && (
        <p className="mt-3 border-l-4 border-black bg-neutral-50 px-3 py-2 text-sm">
          <MicroLabel>Note from support</MicroLabel>
          <span className="mt-1 block">{request.adminNote}</span>
        </p>
      )}
    </article>
  );
}








