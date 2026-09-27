# AIHUB — storefront + admin (Next.js) và API (NestJS)

Cửa hàng tài khoản số: khách xem danh mục/sản phẩm, đặt hàng (chuyển khoản, Zalo hoặc ví AIHUB),
tra cứu đơn và nhận tài khoản; admin quản lý toàn bộ qua dashboard tại `/admin`.

```
DEMO/
├─ src/                 Next.js 16 (App Router) – storefront + admin
│  ├─ app/[...slug]/    mọi trang sản phẩm / danh mục / bài viết / trang tĩnh (ISR 60s từ API)
│  ├─ app/admin/        dashboard + forms (products, categories, promotions, content, settings…)
│  ├─ components/       header/footer, commerce (giỏ, checkout), auth, orders
│  └─ lib/api/          client gọi API (catalog, orders, admin, content, settings)
├─ backend/             NestJS 12 + TypeORM + MySQL – xem backend/README.md
└─ scripts/             sync-wp-content.mjs (kéo dữ liệu WordPress cũ → JSON để importer đọc)
```

## Chạy local

```bash
# 1. API (MySQL `aihub` trên localhost:3306, xem backend/.env)
cd backend && npm install && npm run start:dev      # http://localhost:4000/api, Swagger /docs
npm run import:wp                                    # (lần đầu) nạp danh mục/sản phẩm/bài viết từ WP

# 2. Storefront + admin
npm install && npm run dev                           # http://localhost:3000  (.env: NEXT_PUBLIC_API_URL)
```

Tài khoản admin mặc định: `admin@aihub.local` / `Admin@12345` (đổi trong `backend/.env`).

## Luồng chính

- **Mua hàng**: thẻ/trang sản phẩm → giỏ (localStorage) → `POST /orders` → hướng dẫn chuyển khoản →
  admin xác nhận & giao (tự động từ kho hoặc thủ công) → khách xem tại `/kiem-tra-don-hang`.
- **Admin**: overview thống kê, thông báo, 13 module đọc/ghi API; mỗi sản phẩm có nhiều gói với
  **giá gốc** (`regularPrice`) và **giá bán** (`price`), kho theo từng suất tài khoản.

## Kiểm tra

```bash
npx tsc --noEmit && npx eslint src          # frontend
cd backend && npm run lint && npm run test:e2e   # API (chạy trên MySQL local)
```
# hungidhub
