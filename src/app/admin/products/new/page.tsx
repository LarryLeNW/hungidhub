import type { Metadata } from "next";
import { AdminDashboard } from "../../admin-dashboard";

export const metadata: Metadata = { title: "Thêm sản phẩm" };

export default function NewProductPage() {
  return <AdminDashboard initialView="products" productEditor={{}} />;
}
