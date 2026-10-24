"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Headphones,
  Mail,
  MailCheck,
  MessageCircle,
  PackageCheck,
  QrCode,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  ShoppingCart,
  Sparkles,
} from "lucide-react";
import { siteConfig } from "@/config/site";
import { usePublicSettings } from "@/components/settings/settings-provider";
import type { ContentDoc } from "@/lib/api/content";

type HowToBuyTemplateProps = {
  page: ContentDoc;
};

const guideSteps = [
  {
    step: "1",
    title: "Tìm kiếm & chọn sản phẩm",
    icon: Search,
    desc: "Sử dụng thanh tìm kiếm hoặc duyệt theo danh mục để tìm sản phẩm/công cụ bạn cần (như ChatGPT, Claude AI, Canva Pro, CapCut, Youtube Premium, VPN...).",
    note: "Xem kỹ thông tin mô tả sản phẩm, loại tài khoản (cấp sẵn hoặc nâng cấp chính chủ) và các chế độ bảo hành đi kèm.",
  },
  {
    step: "2",
    title: "Chọn gói thời hạn & điền thông tin",
    icon: SlidersHorizontal,
    desc: "Tại trang chi tiết sản phẩm, chọn gói thời hạn phù hợp với nhu cầu (1 tháng, 3 tháng, 6 tháng, 1 năm...).",
    note: "Nếu sản phẩm yêu cầu nâng cấp trên email cá nhân của bạn, hãy điền email hoặc ghi chú theo hướng dẫn. Chúng tôi cam kết bảo mật thông tin tuyệt đối.",
  },
  {
    step: "3",
    title: "Điền thông tin nhận hàng & Đặt mua",
    icon: ShoppingCart,
    desc: "Bấm 'Mua ngay' hoặc thêm vào giỏ hàng nếu bạn muốn mua nhiều sản phẩm cùng lúc. Tại trang Thanh toán, hãy điền chính xác Họ tên, Số điện thoại và Email.",
    note: "Email nhận hàng rất quan trọng vì hệ thống sẽ tự động gửi thông tin tài khoản và hướng dẫn kích hoạt về email này ngay khi thanh toán.",
  },
  {
    step: "4",
    title: "Quét mã QR thanh toán tự động",
    icon: QrCode,
    desc: "Sử dụng ứng dụng ngân hàng quét mã QR hiển thị trên màn hình để chuyển khoản chính xác số tiền đơn hàng.",
    note: "Đặc biệt lưu ý: Giữ nguyên nội dung chuyển khoản (chứa MÃ ĐƠN HÀNG) để hệ thống tự động xác nhận và xử lý đơn hàng trong 1–5 phút.",
  },
  {
    step: "5",
    title: "Nhận tài khoản & kích hoạt sử dụng",
    icon: MailCheck,
    desc: "Sau khi hệ thống ghi nhận thanh toán, tài khoản và hướng dẫn sử dụng sẽ hiển thị trực tiếp trên màn hình và đồng thời được gửi về Email của bạn.",
    note: "Bạn có thể vào mục 'Kiểm tra đơn hàng' bất kỳ lúc nào để xem lại thông tin tài khoản và trạng thái bảo hành.",
  },
];

const highlights = [
  {
    icon: Clock,
    title: "Giao hàng tự động 24/7",
    text: "Hệ thống xác nhận chuyển khoản và giao tài khoản tự động trong 1–5 phút bất kể ngày đêm hay ngày nghỉ.",
  },
  {
    icon: ShieldCheck,
    title: "Bảo hành trọn thời hạn",
    text: "Cam kết bảo hành đầy đủ theo thời hạn của gói đã mua. Hỗ trợ 1 đổi 1 hoặc hoàn tiền nhanh chóng nếu có sự cố.",
  },
  {
    icon: CheckCircle2,
    title: "Chính hãng & bảo mật",
    text: "Tài khoản chất lượng, hoạt động ổn định. Không thu thập hay lưu trữ thông tin ngân hàng của khách hàng.",
  },
  {
    icon: Headphones,
    title: "Hỗ trợ kỹ thuật 1-1",
    text: "Đội ngũ hỗ trợ nhiệt tình, giải đáp thắc mắc và hướng dẫn sử dụng chi tiết qua Zalo và Email.",
  },
];

export function HowToBuyTemplate({ page }: HowToBuyTemplateProps) {
  const settings = usePublicSettings();
  const storeName = settings["store.name"] ?? siteConfig.name;
  const hotline = settings["store.hotline"] ?? siteConfig.phone;
  const email = settings["store.email"] ?? siteConfig.email;
  const phoneClean = hotline.replace(/\s/g, "");
  const zaloUrl = settings["store.zalo"] ?? `https://zalo.me/${phoneClean}`;

  return (
    <main className="bg-white">
      {/* Hero Header */}
      <section className="border-b border-[#dbe8f2] bg-[#f5f8fb]">
        <div className="ktk-page-frame grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:py-12">
          <div>
            <p className="inline-flex rounded-full bg-[#ecfdf5] px-4 py-1 text-[12px] font-extrabold uppercase text-[#15803d]">
              Hướng dẫn đặt hàng & thanh toán
            </p>
            <h1 className="mt-4 max-w-[760px] text-[32px] font-extrabold leading-tight text-slate-950 lg:text-[42px]">
              Mua sắm tài khoản số tại {storeName} chỉ với 5 bước đơn giản
            </h1>
            <p className="mt-4 max-w-[720px] text-[16px] leading-7 text-slate-600">
              Quy trình mua hàng được tối ưu hoàn toàn tự động: bạn có thể chọn gói, quét mã thanh toán ngân hàng và nhận tài khoản qua email trong chưa đầy 2 phút.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/cua-hang/"
                className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-[6px] bg-[#15803d] px-5 text-[14px] font-extrabold text-white hover:bg-[#166534] transition-colors"
              >
                <PackageCheck size={18} aria-hidden="true" />
                Khám phá sản phẩm
              </Link>
              <Link
                href="/kiem-tra-don-hang/"
                className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-[6px] border border-[#d1d5db] bg-white px-5 text-[14px] font-extrabold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Search size={18} aria-hidden="true" />
                Kiểm tra đơn hàng
              </Link>
              <a
                href={zaloUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-[6px] border border-[#bbf7d0] bg-[#f0fdf4] px-5 text-[14px] font-extrabold text-[#15803d] hover:bg-[#dcfce7] transition-colors"
              >
                <MessageCircle size={18} aria-hidden="true" />
                Nhắn Zalo
              </a>
            </div>
          </div>

          {/* Support Info Sidebar Card */}
          <aside className="rounded-[10px] border border-[#d9f7e5] bg-white p-5 shadow-[0_6px_22px_rgba(15,23,42,0.06)] self-start">
            <h2 className="text-[17px] font-extrabold text-slate-950 flex items-center gap-2">
              <Headphones size={20} className="text-[#15803d]" />
              Kênh hỗ trợ mua hàng
            </h2>
            <div className="mt-4 space-y-3.5 text-[14px] text-slate-600">
              <a
                href={`tel:${phoneClean}`}
                className="flex items-center gap-3 font-semibold text-slate-800 hover:text-[#15803d] transition-colors"
              >
                <span className="grid size-8 place-items-center rounded-full bg-[#f0fdf4] text-[#15803d]">
                  <Headphones size={16} />
                </span>
                <span>
                  Hotline: <strong className="text-slate-950">{hotline}</strong>
                </span>
              </a>
              <a
                href={zaloUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 font-semibold text-slate-800 hover:text-[#15803d] transition-colors"
              >
                <span className="grid size-8 place-items-center rounded-full bg-[#eff6ff] text-[#2563eb]">
                  <MessageCircle size={16} />
                </span>
                <span>
                  Zalo: <strong className="text-slate-950">{hotline}</strong>
                </span>
              </a>
              <a
                href={`mailto:${email}`}
                className="flex items-center gap-3 font-semibold text-slate-800 hover:text-[#15803d] transition-colors"
              >
                <span className="grid size-8 place-items-center rounded-full bg-[#f8fafc] text-slate-600">
                  <Mail size={16} />
                </span>
                <span className="truncate">
                  Email: <strong className="text-slate-950">{email}</strong>
                </span>
              </a>
            </div>
            <div className="mt-5 rounded-[8px] bg-[#f0fdf4] p-3 text-[13px] leading-5 text-slate-700 border border-[#bbf7d0]/60">
              <p className="font-semibold text-[#15803d] mb-1 flex items-center gap-1.5">
                <Sparkles size={14} /> Xử lý tự động 24/7
              </p>
              Hệ thống gửi thông tin đơn hàng và tài khoản qua Email ngay sau khi nhận được chuyển khoản có mã đơn.
            </div>
          </aside>
        </div>
      </section>

      {/* Step by step section */}
      <section className="py-12 bg-white">
        <div className="ktk-page-frame">
          <div className="max-w-[800px] mb-10">
            <h2 className="text-[26px] font-extrabold text-slate-950 lg:text-[32px]">
              5 bước mua hàng & nhận tài khoản tự động
            </h2>
            <p className="mt-2 text-[15px] text-slate-600 leading-relaxed">
              Thực hiện theo các bước dưới đây để hoàn tất đơn hàng nhanh chóng và chính xác nhất.
            </p>
          </div>

          <div className="space-y-6">
            {guideSteps.map((step) => {
              const StepIcon = step.icon;
              return (
                <div
                  key={step.step}
                  className="rounded-[12px] border border-slate-200 bg-[#fafbfc] p-6 transition-all duration-200 hover:border-[#15803d]/40 hover:shadow-md md:p-7"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
                    <div className="flex items-center gap-3 md:flex-col md:items-center">
                      <div className="grid size-12 flex-shrink-0 place-items-center rounded-full bg-[#15803d] text-[20px] font-extrabold text-white shadow-sm">
                        {step.step}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <StepIcon size={20} className="text-[#15803d] flex-shrink-0" />
                        <h3 className="text-[19px] font-extrabold text-slate-950">
                          {step.title}
                        </h3>
                      </div>
                      <p className="text-[15px] leading-7 text-slate-700">
                        {step.desc}
                      </p>
                      <div className="mt-3.5 rounded-[8px] bg-white p-3.5 text-[13px] leading-6 text-slate-600 border border-slate-200/80">
                        <strong className="text-slate-900 font-semibold">Lưu ý: </strong>
                        {step.note}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Highlights / Commitments */}
      <section className="border-y border-slate-200 bg-[#f8fafc] py-12">
        <div className="ktk-page-frame">
          <div className="text-center max-w-[700px] mx-auto mb-10">
            <h2 className="text-[24px] font-extrabold text-slate-950 lg:text-[28px]">
              Cam kết dịch vụ tại {storeName}
            </h2>
            <p className="mt-2 text-[14px] text-slate-600">
              Chúng tôi luôn nỗ lực mang lại trải nghiệm mua sắm số thuận tiện, an toàn và minh bạch nhất.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {highlights.map((item) => {
              const ItemIcon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-[10px] border border-slate-200 bg-white p-5 shadow-sm flex flex-col"
                >
                  <div className="grid size-10 place-items-center rounded-lg bg-[#ecfdf5] text-[#15803d] mb-4">
                    <ItemIcon size={20} />
                  </div>
                  <h3 className="text-[16px] font-bold text-slate-950 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-[13px] leading-6 text-slate-600 flex-1">
                    {item.text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Bottom Emergency Contact Banner */}
      <section className="py-12 bg-white">
        <div className="ktk-page-frame">
          <div className="rounded-[16px] bg-[#1e293b] p-8 md:p-10 text-center text-white shadow-lg">
            <p className="inline-flex rounded-full bg-white/10 px-3.5 py-1 text-[12px] font-bold uppercase tracking-wider text-[#86efac]">
              Hỗ trợ 24/7
            </p>
            <h2 className="mt-4 text-[24px] font-extrabold text-white md:text-[30px]">
              Bạn cần hỗ trợ đặt hàng hoặc bảo hành?
            </h2>
            <p className="mt-3 max-w-[620px] mx-auto text-[15px] leading-relaxed text-slate-300">
              Đội ngũ {storeName} luôn túc trực online để hỗ trợ tư vấn gói cước, giải đáp thắc mắc và xử lý nhanh chóng mọi vấn đề về đơn hàng của bạn.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3.5">
              <a
                href={zaloUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-[8px] bg-[#0068ff] px-6 text-[14px] font-extrabold text-white shadow hover:bg-[#0052cc] transition-colors"
              >
                <MessageCircle size={18} />
                Chat Zalo ({hotline})
              </a>
              <a
                href={`tel:${phoneClean}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-[8px] bg-[#15803d] px-6 text-[14px] font-extrabold text-white shadow hover:bg-[#166534] transition-colors"
              >
                <Headphones size={18} />
                Hotline ({hotline})
              </a>
              <a
                href={`mailto:${email}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-[8px] bg-slate-700 px-6 text-[14px] font-extrabold text-white hover:bg-slate-600 transition-colors"
              >
                <Mail size={18} />
                Gửi Email ({email})
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
