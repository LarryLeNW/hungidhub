import Link from "next/link";
import {
  CheckCircle2,
  Clock3,
  CreditCard,
  Headphones,
  Mail,
  MessageCircle,
  PackageCheck,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { siteConfig } from "@/config/site";
import type { ContentDoc } from "@/lib/api/content";

type AboutTemplateProps = {
  page: ContentDoc;
};

const productGroups = [
  "Công cụ AI",
  "VPN & bảo mật",
  "Thiết kế, video, hình ảnh",
  "Làm việc và học tập",
  "Windows, Office, phần mềm bản quyền",
  "Giải trí, lưu trữ và tiện ích số",
];

const serviceNotes = [
  {
    icon: CheckCircle2,
    title: "Nói rõ trước khi bán",
    text: "Mỗi sản phẩm cần thể hiện đúng loại gói, thời hạn, cách nhận hàng và điều kiện bảo hành để khách tự kiểm tra trước khi đặt.",
  },
  {
    icon: Clock3,
    title: "Giao theo đúng loại sản phẩm",
    text: "Tài khoản có sẵn được xử lý nhanh. Các gói nâng cấp, invite hoặc kích hoạt thủ công sẽ có thời gian riêng ngay trong mô tả.",
  },
  {
    icon: ShieldCheck,
    title: "Bảo hành theo mã đơn",
    text: "Khi phát sinh lỗi, khách gửi mã đơn và ảnh chụp lỗi để đội hỗ trợ kiểm tra đúng gói đã mua, không xử lý theo cảm tính.",
  },
];

const orderSteps = [
  "Chọn sản phẩm phù hợp với nhu cầu và ngân sách.",
  "Điền email nhận hàng, số điện thoại và ghi chú nếu sản phẩm cần nâng cấp vào tài khoản cá nhân.",
  "Thanh toán theo hướng dẫn trên đơn hàng.",
  "Nhận thông tin tài khoản hoặc hướng dẫn kích hoạt, sau đó kiểm tra lại ngay trong thời gian bảo hành.",
];

const commitments = [
  "Không dùng thông tin mập mờ để bán gói cao hơn nhu cầu.",
  "Không lưu thông tin thẻ ngân hàng của khách trên hệ thống.",
  "Hỗ trợ qua Zalo, Telegram hoặc kênh chat khi cần kiểm tra đơn.",
  "Chính sách bảo hành được áp dụng theo từng sản phẩm và thời hạn đã mua.",
];

export function AboutTemplate({ page }: AboutTemplateProps) {
  const updatedAt = formatDate(page.updatedAt);
  const phoneHref = siteConfig.phone.replace(/\s/g, "");

  return (
    <main className="bg-white">
      <section className="border-b border-[#dbe8f2] bg-[#f5f8fb]">
        <div className="ktk-page-frame grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:py-12">
          <div>
            <p className="inline-flex rounded-full bg-[#ecfdf5] px-4 py-1 text-[12px] font-extrabold uppercase text-[#15803d]">
              Giới thiệu Idhub
            </p>
            <h1 className="mt-5 max-w-[760px] text-[34px] font-extrabold leading-tight text-slate-950 lg:text-[44px]">
              Nơi mua tài khoản số rõ thông tin, dễ nhận hàng và có hỗ trợ sau bán
            </h1>
            <p className="mt-4 max-w-[720px] text-[16px] leading-7 text-slate-600">
              Idhub cung cấp tài khoản premium, công cụ AI và phần mềm bản quyền cho người dùng cá nhân, freelancer, team nhỏ và người học. Mục tiêu của trang không phải là liệt kê thật nhiều con số, mà là giúp bạn biết mình đang mua gì, nhận bằng cách nào và cần liên hệ ai khi phát sinh vấn đề.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/cua-hang/"
                className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-[6px] bg-[#15803d] px-5 text-[14px] font-extrabold text-white"
              >
                <PackageCheck size={18} aria-hidden="true" />
                Xem sản phẩm
              </Link>
              <a
                href={`https://zalo.me/${phoneHref}`}
                className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-[6px] border border-[#bbf7d0] bg-white px-5 text-[14px] font-extrabold text-[#15803d]"
              >
                <MessageCircle size={18} aria-hidden="true" />
                Nhắn Zalo
              </a>
            </div>
          </div>

          <aside className="rounded-[8px] border border-[#d9f7e5] bg-white p-5 shadow-[0_6px_22px_rgba(15,23,42,0.06)]">
            <h2 className="text-[17px] font-extrabold text-slate-950">Thông tin hỗ trợ</h2>
            <div className="mt-4 space-y-3 text-[14px] text-slate-600">
              <a href={`tel:${phoneHref}`} className="flex items-center gap-3 hover:text-[#15803d]">
                <Headphones size={18} className="text-[#15803d]" aria-hidden="true" />
                {siteConfig.phone}
              </a>
              <a href={`mailto:${siteConfig.email}`} className="flex items-center gap-3 hover:text-[#15803d]">
                <Mail size={18} className="text-[#15803d]" aria-hidden="true" />
                {siteConfig.email}
              </a>
              <p className="flex items-center gap-3">
                <Clock3 size={18} className="text-[#15803d]" aria-hidden="true" />
                Hỗ trợ trong ngày, ưu tiên đơn đang chờ xử lý
              </p>
            </div>
            <p className="mt-5 rounded-[6px] bg-[#f0fdf4] p-3 text-[13px] leading-5 text-slate-600">
              Khi cần bảo hành, gửi kèm mã đơn, email nhận hàng và ảnh lỗi. Cách này giúp đội hỗ trợ kiểm tra đúng gói, đúng thời hạn.
            </p>
          </aside>
        </div>
      </section>

      <section className="bg-white py-10">
        <div className="ktk-page-frame">
          <div className="grid gap-8 lg:grid-cols-[330px_minmax(0,1fr)]">
            <div>
              <p className="text-[12px] font-extrabold uppercase text-[#15803d]">Idhub làm gì?</p>
              <h2 className="mt-2 text-[25px] font-extrabold leading-tight text-slate-950">
                Gom các công cụ số phổ biến vào một nơi dễ mua hơn
              </h2>
              <p className="mt-3 text-[14px] leading-6 text-slate-600">
                Thay vì tự mở thẻ quốc tế, tự xử lý thanh toán ngoại tệ hoặc dò từng điều kiện gói, bạn có thể chọn sản phẩm theo nhu cầu và nhận hướng dẫn sử dụng bằng tiếng Việt.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {productGroups.map((group) => (
                <div key={group} className="rounded-[8px] border border-[#e5edf6] bg-[#f8fbff] px-4 py-3 text-[14px] font-extrabold text-slate-900">
                  {group}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f5f5f5] py-10">
        <div className="ktk-page-frame">
          <div className="max-w-[760px]">
            <p className="text-[12px] font-extrabold uppercase text-[#15803d]">Cách vận hành</p>
            <h2 className="mt-2 text-[25px] font-extrabold leading-tight text-slate-950">
              Tập trung vào đơn hàng thật, không phóng đại bằng số liệu khó kiểm chứng
            </h2>
            <p className="mt-3 text-[14px] leading-6 text-slate-600">
              Mỗi ngày Idhub xử lý các đơn có sẵn, đơn nâng cấp và yêu cầu bảo hành. Điều quan trọng là thông tin phải dễ hiểu, khách nhận đúng thứ đã mua và có đường liên hệ khi cần kiểm tra lại.
            </p>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {serviceNotes.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-[8px] border border-[#e5edf6] bg-white p-5 shadow-[0_4px_14px_rgba(15,23,42,0.05)]">
                <Icon size={24} className="text-[#15803d]" aria-hidden="true" />
                <h3 className="mt-4 text-[16px] font-extrabold text-slate-950">{title}</h3>
                <p className="mt-2 text-[14px] leading-6 text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-10">
        <div className="ktk-page-frame grid gap-8 lg:grid-cols-2">
          <div>
            <p className="text-[12px] font-extrabold uppercase text-[#15803d]">Quy trình mua hàng</p>
            <h2 className="mt-2 text-[25px] font-extrabold leading-tight text-slate-950">
              Đi từng bước để tránh nhầm gói hoặc nhầm email nhận hàng
            </h2>
            <div className="mt-6 space-y-3">
              {orderSteps.map((step, index) => (
                <div key={step} className="flex gap-3 rounded-[8px] border border-[#e5edf6] bg-white p-4">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#15803d] text-[13px] font-extrabold text-white">
                    {index + 1}
                  </span>
                  <p className="text-[14px] leading-6 text-slate-600">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[8px] border border-[#d9f7e5] bg-[#f7fffa] p-6">
            <Sparkles size={28} className="text-[#15803d]" aria-hidden="true" />
            <h2 className="mt-4 text-[22px] font-extrabold text-slate-950">Cam kết khi dùng dịch vụ</h2>
            <ul className="mt-5 space-y-3">
              {commitments.map((item) => (
                <li key={item} className="flex gap-3 text-[14px] leading-6 text-slate-600">
                  <CheckCircle2 size={18} className="mt-1 shrink-0 text-[#15803d]" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-[8px] bg-white p-4">
              <div className="flex items-center gap-3 text-[14px] font-extrabold text-slate-950">
                <CreditCard size={19} className="text-[#15803d]" aria-hidden="true" />
                Thanh toán và thông tin đơn
              </div>
              <p className="mt-2 text-[13px] leading-5 text-slate-600">
                Luôn kiểm tra email nhận hàng, số điện thoại và ghi chú trước khi thanh toán. Đây là thông tin Idhub dùng để giao tài khoản và hỗ trợ sau mua.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[#e5edf6] bg-[#f5f8fb] py-8">
        <div className="ktk-page-frame flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-[22px] font-extrabold text-slate-950">Cần chọn gói phù hợp?</h2>
            <p className="mt-2 max-w-[680px] text-[14px] leading-6 text-slate-600">
              Gửi nhu cầu sử dụng, thiết bị đang dùng và thời hạn mong muốn. Idhub sẽ gợi ý theo nhu cầu thực tế thay vì chỉ đẩy gói đắt nhất.
            </p>
            <p className="mt-2 text-[12px] font-semibold text-slate-400">Cập nhật nội dung: {updatedAt}</p>
          </div>
          <a
            href={`https://zalo.me/${phoneHref}`}
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] bg-[#15803d] px-5 text-[14px] font-extrabold text-white"
          >
            <MessageCircle size={18} aria-hidden="true" />
            Tư vấn qua Zalo
          </a>
        </div>
      </section>
    </main>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "đang cập nhật";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
