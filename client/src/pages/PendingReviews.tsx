type Tab =
  | "pending-ratings"
  | "order-history";

const navItems = [
  {
    section: "My Account",
    icon: "User",
    items: [
      { id: "pending-ratings", label: "Pending Ratings" },
      { id: "order-history", label: "Order History" },
    ],
  },
};

function OrdersSection() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Order History</h2>
      <div className="bg-white p-4 border border-gray-300 rounded">
        <p className="text-gray-500">No orders found.</p>
      </div>
    </div>
  );
}

function PendingRatingsSection({
  orders,
}: {
  orders: Order[];
  pendingRatingsCount: number;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Pending Ratings {pendingRatingsCount > 0 && (
        <span className="ml-auto px-2 py-0.5 rounded bg-gray-200 text-gray-600 text-xs font-bold">
          {pendingRatingsCount}
        </span>
      )}</h2>
      {orders.length === 0 ? (
        <p className="text-gray-500">No delivered orders found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orders.map((order) => (
            <div key={order.id} className="bg-white p-4 border border-gray-300 rounded">
              <h3 className="text-sm font-medium">
                {fmt(order.total)} · {formatDateTime(order.createdAt)}
              </h3>
              <p className="text-sm text-gray-500">
                {order.items.map((item) => `${itemLabel(item)} × ${item.qty ?? 1}`).join(", ")}
              </p>
              <button
                className="mt-2 text-blue-600 hover:text-blue-800"
                onClick={() => {
                  toast.info("Submit rating for this order (not implemented yet)")
                }}
              >
                Submit Rating
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PendingReviews() {
  const { user: authUser, token } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("pending-ratings");
  const [userData, setUserData] = useState<User | null>(null);
  const [pendingRatingsCount, setPendingRatingsCount] = useState(0);

  const loadUser = useCallback(async () => {
    try {
      const data = await apiRequest("/users/me", { token: token ?? undefined });
      setUserData(data);
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response
          ?.data?.message || "Failed to load profile"
      );
    }
  }, [token]);

  const loadPendingRatingsCount = useCallback(async () => {
    try {
      const data = await apiRequest("/ratings/pending-count", {
        token: token ?? undefined,
      });
      if (typeof data === "number") {
        setPendingRatingsCount(data);
      } else if (data && typeof data.count === "number") {
        setPendingRatingsCount(data.count);
      }
    } catch {
      // Silent fail
    }
  }, [token]);

  useEffect(() => {
    const loadData = async () => {
      if (!token) {
        navigate("/login");
        return;
      }
      await loadUser();
      await loadPendingRatingsCount();
    };
    loadData();
  }, [token, navigate, loadUser, loadPendingRatingsCount]);

  return (
    <PageShell title="Pending Reviews" breadcrumb="PENDING REVIEWS">
      <div className="border-2 border-black bg-neutral-50 min-h-screen">
        <div className="flex h-screen">
          {/* Sidebar */}
          <aside className="w-64 border-r border-black bg-white hidden md:flex flex-col">
            <div className="p-4">
              <h2 className="text-lg font-bold">My Account</h2>
              <p className="text-sm text-gray-500">
                {authUser?.email || ""}
              </p>
              <nav className="mt-6 space-y-4">
                {navItems.map((group) => (
                  <div key={group.section} className="mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="text-sm font-semibold text-gray-800">
                        {group.section}
                      </h3>
                    </div>
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setTab(item.id as Tab)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-left ${
                          tab === item.id ? "bg-black text-white" : "text-gray-600 hover:bg-neutral-100 hover:text-gray-900"
                        }`}
                      >
                        {item.label}
                        {item.id === "pending-ratings" && (
                          <span className="ml-auto px-2 py-0.5 rounded bg-gray-200 text-gray-600 text-xs font-bold">
                            {pendingRatingsCount}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 p-8 md:p-12 overflow-y-auto">
            {tab === "pending-ratings" && (
              <PendingRatingsSection
                orders={[]}
                pendingRatingsCount={pendingRatingsCount}
              />
            )}
            {tab === "order-history" && <OrdersSection />}
          </main>
        </div>
      </div>
    </PageShell>
  );
}
