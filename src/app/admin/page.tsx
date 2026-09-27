import type { Metadata } from "next";
import { AdminDashboard } from "./admin-dashboard";

export const metadata: Metadata = {
  title: "Quản trị hệ thống",
  description: "Trung tâm quản trị cửa hàng Idhub.",
};

export default function AdminPage() {
  return <AdminDashboard initialView="overview" />;
}
