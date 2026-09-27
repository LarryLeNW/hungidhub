import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminDashboard } from "../../admin-dashboard";

export const metadata: Metadata = { title: "Sửa sản phẩm" };

export default async function EditProductPage(props: PageProps<"/admin/products/[id]">) {
  const { id } = await props.params;
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) notFound();
  return <AdminDashboard initialView="products" productEditor={{ id: productId }} />;
}
