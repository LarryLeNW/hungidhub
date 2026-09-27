import type { Metadata } from "next";
import { CheckoutPageContent } from "@/components/commerce/commerce-provider";

export const metadata: Metadata = {
  title: "Thanh toán",
};

export default function CheckoutPage() {
  return (
    <main className="min-h-[70vh] bg-[#f5f8fb]">
      <CheckoutPageContent />
    </main>
  );
}
