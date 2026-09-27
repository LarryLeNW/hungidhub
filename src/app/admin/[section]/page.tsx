import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminDashboard, type AdminSection } from "../admin-dashboard";

const sections: AdminSection[] = [
  "traffic",
  "orders",
  "products",
  "inventory",
  "customers",
  "transactions",
  "posts",
  "categories",
  "promotions",
  "content",
  "support",
  "reviews",
  "reports",
  "settings",
];

export const metadata: Metadata = {
  title: "Quản trị hệ thống",
};

export function generateStaticParams() {
  return sections.map((section) => ({ section }));
}

export default async function AdminSectionPage(props: PageProps<"/admin/[section]">) {
  const { section } = await props.params;
  if (!sections.includes(section as AdminSection)) notFound();
  return <AdminDashboard initialView={section as AdminSection} />;
}
