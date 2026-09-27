import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import OrderConfirmation from "./pages/OrderConfirmation";
import OrderTracking from "./pages/OrderTracking";
import AdminRoute from "./components/AdminRoutes";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminLayout from "./components/admin/AdminLayout";
import AdminDeliveryPartners from "./pages/admin/AdminDeliveryPartners";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminSupportInbox from "./pages/admin/AdminSupportInbox";
import AdminUsers from "./pages/admin/AdminUsers";
import SellProduct from "./pages/SellProduct";
import AdminListingReview from "./pages/admin/AdminListingReview";
import AdminReturns from "./pages/admin/AdminReturns";
import ListingFeeReturn from "./pages/ListingFeeReturn";
import TrackOrderLookup from "./pages/TrackOrderLookup";
import HelpCenter from "./pages/HelpCenter";
import MyOrders from "./pages/MyOrders";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/products/:id" element={<ProductDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/orders/:id" element={<OrderConfirmation />} />
        <Route path="/track-order" element={<TrackOrderLookup />} />
        <Route path="/help" element={<HelpCenter />} />
        <Route path="/track/:id" element={<OrderTracking />} />
        <Route path="/sell" element={<SellProduct />} />
        <Route path="/sell/fee/verify" element={<ListingFeeReturn />} />
        <Route path="/my-orders" element={<MyOrders />} />
        <Route path="/returns-and-orders" element={<MyOrders />} />
      </Route>

      <Route element={<AdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/products" element={<AdminProducts />} />
          <Route path="/admin/orders" element={<AdminOrders />} />
          <Route
            path="/admin/delivery-partners"
            element={<AdminDeliveryPartners />}
          />
          <Route path="/admin/support" element={<AdminSupportInbox />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/listings" element={<AdminListingReview />} />
          <Route path="/admin/returns" element={<AdminReturns />} />
        </Route>
      </Route>

      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
    </Routes>
  );
}

export default App;
