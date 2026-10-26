import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/useAuth";

export default function CustomerAccessRoute() {
  const { user } = useAuth();

  if (user?.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  return <Outlet />;
}
