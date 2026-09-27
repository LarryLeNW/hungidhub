"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Heart,
  Minus,
  PackageCheck,
  Plus,
  ShoppingCart,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { AccountPanel } from "@/components/auth/account-panel";
import { LoginForm, RegisterForm } from "@/components/auth/auth-forms";
import { useAuth, type AuthStatus } from "@/components/auth/auth-provider";
import { OrderSummary } from "@/components/orders/order-summary";
import type { AuthUser } from "@/lib/api/auth";
import { ordersApi, type ApiOrder, type PaymentMethod } from "@/lib/api/orders";
import { formatCurrency } from "@/lib/format";

export type CommerceProductSnapshot = {
  id: string;
  slug: string;
  title: string;
  image?: string;
  price: number;
  regularPrice?: number;
};

export type CartLine = CommerceProductSnapshot & {
  lineId: string;
  /** Backend variant id; lines added while the API was offline have none and cannot be ordered. */
  variantId?: number;
  variantLabel: string;
  durationLabel?: string;
  quantity: number;
};

type CheckoutDraft = {
  note: string;
  paymentMethod: PaymentMethod;
};

export type CommerceDrawer = "cart" | "wishlist" | "account" | "checkout";

type CommerceContextValue = {
  cart: CartLine[];
  wishlist: CommerceProductSnapshot[];
  cartCount: number;
  wishlistCount: number;
  subtotal: number;
  drawer: CommerceDrawer | null;
  checkoutDraft: CheckoutDraft;
  placedOrder: ApiOrder | null;
  checkoutError: string | null;
  checkoutPending: boolean;
  authStatus: AuthStatus;
  user: AuthUser | null;
  isWishlisted: (slug: string) => boolean;
  addToCart: (
    product: CommerceProductSnapshot,
    options?: {
      variantId?: number;
      variantLabel?: string;
      durationLabel?: string;
      quantity?: number;
    },
  ) => void;
  removeFromCart: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  toggleWishlist: (product: CommerceProductSnapshot) => void;
  closeDrawer: () => void;
  openCart: () => void;
  openWishlist: () => void;
  openAccount: () => void;
  openCheckout: () => void;
  updateCheckoutDraft: (draft: CheckoutDraft) => void;
  submitCheckout: () => Promise<void>;
  resetCheckout: () => void;
};

const CommerceContext = createContext<CommerceContextValue | null>(null);

const cartStorageKey = "ktk.cart.v1";
const wishlistStorageKey = "ktk.wishlist.v1";

function prefersPageSurface() {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
}

function normalizeWishlist(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) =>
      typeof item === "string"
        ? wishlistSnapshotFromSlug(item)
        : wishlistSnapshotFromStoredItem(item),
    )
    .filter((item): item is CommerceProductSnapshot => Boolean(item));
}

function wishlistSnapshotFromStoredItem(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Partial<CommerceProductSnapshot>;

  if (!item.slug || typeof item.slug !== "string") {
    return null;
  }

  const fallback = wishlistSnapshotFromSlug(item.slug);

  return {
    id: String(item.id ?? fallback?.id ?? item.slug),
    slug: item.slug,
    title: String(item.title ?? fallback?.title ?? `/${item.slug}`),
    image: typeof item.image === "string" ? item.image : fallback?.image,
    price: typeof item.price === "number" ? item.price : fallback?.price ?? 0,
    regularPrice:
      typeof item.regularPrice === "number"
        ? item.regularPrice
        : fallback?.regularPrice,
  };
}

/** Legacy wishlist entries stored only a slug; keep the link, the card shows no price. */
function wishlistSnapshotFromSlug(slug: string): CommerceProductSnapshot {
  return {
    id: slug,
    slug,
    title: `/${slug}`,
    image: undefined,
    price: 0,
    regularPrice: undefined,
  };
}

export function CommerceProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [wishlist, setWishlist] = useState<CommerceProductSnapshot[]>([]);
  const [drawer, setDrawer] = useState<CommerceDrawer | null>(
    null,
  );
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);
  const { status, user } = useAuth();
  const [checkoutDraft, setCheckoutDraft] = useState<CheckoutDraft>({
    note: "",
    paymentMethod: "bank_transfer",
  });
  const [placedOrder, setPlacedOrder] = useState<ApiOrder | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutPending, setCheckoutPending] = useState(false);

  const effectiveDraft = useMemo<CheckoutDraft>(
    () => ({
      ...checkoutDraft,
      paymentMethod:
        checkoutDraft.paymentMethod === "wallet" ? "bank_transfer" : checkoutDraft.paymentMethod,
    }),
    [checkoutDraft],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const savedCart = window.localStorage.getItem(cartStorageKey);
        const savedWishlist = window.localStorage.getItem(wishlistStorageKey);
        if (savedCart) setCart(JSON.parse(savedCart) as CartLine[]);
        if (savedWishlist) setWishlist(normalizeWishlist(JSON.parse(savedWishlist)));
      } catch {
        setCart([]);
        setWishlist([]);
      } finally {
        setHasLoadedStorage(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hasLoadedStorage) return;
    window.localStorage.setItem(cartStorageKey, JSON.stringify(cart));
  }, [cart, hasLoadedStorage]);

  useEffect(() => {
    if (!hasLoadedStorage) return;
    window.localStorage.setItem(wishlistStorageKey, JSON.stringify(wishlist));
  }, [hasLoadedStorage, wishlist]);

  const addToCart = useCallback<CommerceContextValue["addToCart"]>(
    (product, options) => {
      const variantLabel = options?.variantLabel ?? "Gói mặc định";
      const durationLabel = options?.durationLabel;
      const variantId = options?.variantId;
      const lineKey = `${product.slug}::${variantId ?? variantLabel}::${durationLabel ?? ""}`;
      const quantity = options?.quantity ?? 1;

      setCart((current) => {
        const existing = current.find((item) => item.lineId === lineKey);
        if (existing) {
          return current.map((item) =>
            item.lineId === lineKey
              ? { ...item, quantity: Math.min(item.quantity + quantity, 99) }
              : item,
          );
        }

        return [
          ...current,
          {
            ...product,
            lineId: lineKey,
            variantId,
            variantLabel,
            durationLabel,
            quantity,
          },
        ];
      });
      setDrawer("cart");
    },
    [],
  );

  const removeFromCart = useCallback((lineId: string) => {
    setCart((current) => current.filter((item) => item.lineId !== lineId));
  }, []);

  const updateQuantity = useCallback((lineId: string, quantity: number) => {
    setCart((current) =>
      current.map((item) =>
        item.lineId === lineId
          ? { ...item, quantity: Math.max(1, Math.min(quantity, 99)) }
          : item,
      ),
    );
  }, []);

  const toggleWishlist = useCallback((product: CommerceProductSnapshot) => {
    setWishlist((current) =>
      current.some((item) => item.slug === product.slug)
        ? current.filter((item) => item.slug !== product.slug)
        : [product, ...current],
    );
  }, []);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart],
  );

  const resetCheckout = useCallback(() => {
    setPlacedOrder(null);
    setCheckoutError(null);
  }, []);

  const submitCheckout = useCallback(async () => {
    if (!user) {
      setCheckoutError("Vui lòng đăng nhập hoặc tạo tài khoản để đặt hàng.");
      return;
    }
    const missing = cart.filter((line) => !line.variantId);
    if (missing.length) {
      setCheckoutError(
        `Giỏ hàng có sản phẩm được thêm khi máy chủ chưa sẵn sàng (${missing
          .map((line) => line.title)
          .join(", ")}). Vui lòng xóa và thêm lại.`,
      );
      return;
    }

    setCheckoutError(null);
    setCheckoutPending(true);
    try {
      const order = await ordersApi.create({
        items: cart.map((line) => ({ variantId: line.variantId as number, quantity: line.quantity })),
        paymentMethod: effectiveDraft.paymentMethod,
        note: effectiveDraft.note.trim() || undefined,
      });
      setPlacedOrder(order);
      setCart([]);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Không tạo được đơn hàng.");
    } finally {
      setCheckoutPending(false);
    }
  }, [cart, effectiveDraft, user]);

  const value = useMemo<CommerceContextValue>(
    () => ({
      cart,
      wishlist,
      cartCount: cart.reduce((sum, item) => sum + item.quantity, 0),
      wishlistCount: wishlist.length,
      subtotal,
      drawer,
      checkoutDraft: effectiveDraft,
      placedOrder,
      checkoutError,
      checkoutPending,
      authStatus: status,
      user,
      isWishlisted: (slug) => wishlist.some((item) => item.slug === slug),
      addToCart,
      removeFromCart,
      updateQuantity,
      toggleWishlist,
      closeDrawer: () => setDrawer(null),
      openCart: () => setDrawer("cart"),
      openWishlist: () => setDrawer("wishlist"),
      openAccount: () => {
        if (prefersPageSurface()) {
          setDrawer(null);
          router.push("/tai-khoan");
          return;
        }
        setDrawer("account");
      },
      openCheckout: () => {
        resetCheckout();
        if (prefersPageSurface()) {
          setDrawer(null);
          router.push("/thanh-toan");
          return;
        }
        setDrawer("checkout");
      },
      updateCheckoutDraft: setCheckoutDraft,
      submitCheckout,
      resetCheckout,
    }),
    [
      addToCart,
      cart,
      checkoutError,
      checkoutPending,
      drawer,
      effectiveDraft,
      placedOrder,
      removeFromCart,
      resetCheckout,
      router,
      status,
      submitCheckout,
      subtotal,
      toggleWishlist,
      updateQuantity,
      user,
      wishlist,
    ],
  );

  return (
    <CommerceContext.Provider value={value}>
      {children}
      {drawer ? (
        <div className="fixed inset-x-0 top-0 bottom-[calc(68px+env(safe-area-inset-bottom))] z-[80] lg:bottom-0">
          <button
            className="absolute inset-0 bg-slate-950/40"
            type="button"
            aria-label="Đóng"
            onClick={() => setDrawer(null)}
          />
          <aside className="absolute right-0 top-0 flex h-full w-[70vw] min-w-[270px] max-w-[420px] flex-col bg-white shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-border px-5">
              <h2 className="inline-flex items-center gap-2 text-lg font-extrabold text-slate-950">
                {drawer === "cart" ? <ShoppingCart size={20} /> : null}
                {drawer === "wishlist" ? <Heart size={20} /> : null}
                {drawer === "account" ? <UserRound size={20} /> : null}
                {drawer === "checkout" ? <PackageCheck size={20} /> : null}
                {drawer === "cart"
                  ? "Giỏ hàng"
                  : drawer === "wishlist"
                    ? "Yêu thích"
                    : drawer === "account"
                      ? "Tài khoản"
                      : "Thanh toán"}
              </h2>
              <button
                className="focus-ring grid size-9 place-items-center rounded-full hover:bg-slate-100"
                type="button"
                aria-label="Đóng"
                onClick={() => setDrawer(null)}
              >
                <X size={20} />
              </button>
            </div>

            {drawer === "cart" ? (
              <CartDrawer
                cart={cart}
                subtotal={subtotal}
                onProductClick={() => setDrawer(null)}
                onCheckout={value.openCheckout}
                onRemove={removeFromCart}
                onUpdateQuantity={updateQuantity}
              />
            ) : null}

            {drawer === "wishlist" ? (
              <WishlistDrawer
                wishlist={wishlist}
                onProductClick={() => setDrawer(null)}
                onRemove={(slug) =>
                  setWishlist((current) => current.filter((item) => item.slug !== slug))
                }
              />
            ) : null}

            {drawer === "account" ? (
              <AccountPanel onNavigate={() => setDrawer(null)} />
            ) : null}

            {drawer === "checkout" ? (
              <CheckoutDrawer
                cart={cart}
                draft={effectiveDraft}
                placedOrder={placedOrder}
                error={checkoutError}
                pending={checkoutPending}
                authStatus={status}
                user={user}
                subtotal={subtotal}
                onChange={setCheckoutDraft}
                onAuthSuccess={() => setCheckoutError(null)}
                onSubmit={() => void submitCheckout()}
                onClose={() => setDrawer(null)}
              />
            ) : null}
          </aside>
        </div>
      ) : null}
    </CommerceContext.Provider>
  );
}

export function useCommerce() {
  const context = useContext(CommerceContext);
  if (!context) {
    throw new Error("useCommerce must be used inside CommerceProvider");
  }
  return context;
}

export function CheckoutPageContent() {
  const commerce = useCommerce();

  return (
    <div className="ktk-page-frame py-8 lg:py-10">
      <div className="mb-7">
        <p className="text-[12px] font-extrabold uppercase text-primary-strong">Thanh toán đơn hàng</p>
        <h1 className="mt-1 text-[30px] font-extrabold text-slate-950">Hoàn tất đặt hàng</h1>
        <p className="mt-2 max-w-[680px] text-[15px] leading-6 text-slate-600">
          Đăng nhập để Idhub lưu đơn vào tài khoản, sau đó quét QR chuyển khoản đúng số tiền và nội dung.
        </p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,760px)_360px]">
        <div className="rounded-[8px] border border-border bg-white shadow-sm">
          <CheckoutDrawer
            cart={commerce.cart}
            draft={commerce.checkoutDraft}
            placedOrder={commerce.placedOrder}
            error={commerce.checkoutError}
            pending={commerce.checkoutPending}
            authStatus={commerce.authStatus}
            user={commerce.user}
            subtotal={commerce.subtotal}
            onChange={commerce.updateCheckoutDraft}
            onAuthSuccess={() => commerce.resetCheckout()}
            onSubmit={() => void commerce.submitCheckout()}
            onClose={commerce.closeDrawer}
            surface="page"
          />
        </div>
        <CheckoutOrderSummary cart={commerce.cart} subtotal={commerce.subtotal} />
      </div>
    </div>
  );
}

function CheckoutOrderSummary({ cart, subtotal }: { cart: CartLine[]; subtotal: number }) {
  const quantity = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <aside className="sticky top-6 rounded-[8px] border border-border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[18px] font-extrabold text-slate-950">Tóm tắt đơn</h2>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-extrabold text-emerald-700">
          {quantity} sản phẩm
        </span>
      </div>

      {cart.length ? (
        <ul className="mt-4 divide-y divide-border">
          {cart.map((item) => (
            <li key={item.lineId} className="flex gap-3 py-3">
              {item.image ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.image} alt={item.title} className="size-14 rounded-md object-cover" />
                </>
              ) : (
                <div className="grid size-14 shrink-0 place-items-center rounded-md bg-surface-muted text-xs font-extrabold text-primary-strong">
                  AI
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[13px] font-extrabold text-slate-950">{item.title}</p>
                <p className="mt-1 text-[12px] text-muted">
                  {[item.variantLabel, item.durationLabel].filter(Boolean).join(" · ")} × {item.quantity}
                </p>
              </div>
              <span className="shrink-0 text-[13px] font-extrabold text-slate-900">
                {formatCurrency(item.price * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-md border border-dashed border-border p-4 text-center text-[13px] text-muted">
          Giỏ hàng đang trống.
        </p>
      )}

      <div className="mt-4 space-y-2 border-t border-border pt-4 text-[14px]">
        <div className="flex justify-between text-slate-600">
          <span>Tạm tính</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between text-[18px] font-black text-slate-950">
          <span>Tổng thanh toán</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
      </div>
    </aside>
  );
}

function CartDrawer({
  cart,
  subtotal,
  onProductClick,
  onCheckout,
  onRemove,
  onUpdateQuantity,
}: {
  cart: CartLine[];
  subtotal: number;
  onProductClick: () => void;
  onCheckout: () => void;
  onRemove: (lineId: string) => void;
  onUpdateQuantity: (lineId: string, quantity: number) => void;
}) {
  if (!cart.length) {
    return (
      <div className="grid flex-1 place-items-center p-6 text-center">
        <div>
          <ShoppingCart className="mx-auto text-slate-300" size={46} />
          <p className="mt-4 font-bold text-slate-700">Giỏ hàng đang trống</p>
          <p className="mt-2 text-sm text-muted">Chọn gói sản phẩm để bắt đầu đơn hàng.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 space-y-4 overflow-auto p-5">
        {cart.map((item) => (
          <div key={item.lineId} className="rounded-md border border-border p-3">
            <div className="flex gap-3">
              {item.image ? (
                  <Link href={`/${item.slug}`} onClick={onProductClick}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image}
                      alt={item.title}
                      className="size-16 rounded-md object-cover"
                    />
                  </Link>
              ) : null}
              <div className="min-w-0 flex-1">
                <Link
                  href={`/${item.slug}`}
                  className="line-clamp-2 font-extrabold text-slate-950"
                  onClick={onProductClick}
                >
                  {item.title}
                </Link>
                <p className="mt-1 text-xs font-semibold text-muted">
                  {item.variantLabel}
                  {item.durationLabel ? ` · ${item.durationLabel}` : ""}
                </p>
                <p className="mt-2 font-extrabold text-primary-strong">
                  {formatCurrency(item.price)}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="inline-flex h-9 items-center rounded-md border border-border">
                <button
                  className="grid size-9 place-items-center"
                  type="button"
                  aria-label="Giảm số lượng"
                  onClick={() => onUpdateQuantity(item.lineId, item.quantity - 1)}
                >
                  <Minus size={15} />
                </button>
                <span className="min-w-8 text-center text-sm font-bold">
                  {item.quantity}
                </span>
                <button
                  className="grid size-9 place-items-center"
                  type="button"
                  aria-label="Tăng số lượng"
                  onClick={() => onUpdateQuantity(item.lineId, item.quantity + 1)}
                >
                  <Plus size={15} />
                </button>
              </div>
              <button
                className="inline-flex items-center gap-1 text-sm font-bold text-danger"
                type="button"
                onClick={() => onRemove(item.lineId)}
              >
                <Trash2 size={16} />
                Xóa
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border p-5">
        <div className="mb-4 flex items-center justify-between font-extrabold">
          <span>Tạm tính</span>
          <span className="text-primary-strong">{formatCurrency(subtotal)}</span>
        </div>
        <button
          className="focus-ring h-12 w-full rounded-md bg-primary font-extrabold text-white"
          type="button"
          onClick={onCheckout}
        >
          Tiến hành thanh toán
        </button>
      </div>
    </>
  );
}

function WishlistDrawer({
  wishlist,
  onProductClick,
  onRemove,
}: {
  wishlist: CommerceProductSnapshot[];
  onProductClick: () => void;
  onRemove: (slug: string) => void;
}) {
  return (
    <div className="flex-1 overflow-auto p-5">
      {wishlist.length ? (
        <div className="space-y-4">
          {wishlist.map((item) => (
            <div key={item.slug} className="rounded-md border border-border p-3">
              <div className="flex gap-3">
                {item.image ? (
                  <Link href={`/${item.slug}`} onClick={onProductClick}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image}
                      alt={item.title}
                      className="size-16 rounded-md object-cover"
                    />
                  </Link>
                ) : (
                  <div className="grid size-16 shrink-0 place-items-center rounded-md bg-surface-muted text-xs font-extrabold text-primary-strong">
                    AI
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/${item.slug}`}
                    className="line-clamp-2 font-extrabold text-slate-950 hover:text-primary-strong"
                    onClick={onProductClick}
                  >
                    {item.title}
                  </Link>
                  {item.price > 0 ? (
                    <div className="mt-2">
                      <p className="font-extrabold text-primary-strong">
                        {formatCurrency(item.price)}
                      </p>
                      {item.regularPrice && item.regularPrice > item.price ? (
                        <p className="text-xs font-semibold text-slate-400 line-through">
                          {formatCurrency(item.regularPrice)}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Link
                  href={`/${item.slug}`}
                  className="text-sm font-bold text-primary-strong"
                  onClick={onProductClick}
                >
                  Xem sản phẩm
                </Link>
                <button
                  className="inline-flex items-center gap-1 text-sm font-bold text-danger"
                  type="button"
                  onClick={() => onRemove(item.slug)}
                >
                  <Trash2 size={16} />
                  Xóa
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid h-full place-items-center text-center">
          <div>
            <Heart className="mx-auto text-slate-300" size={46} />
            <p className="mt-4 font-bold text-slate-700">Chưa có sản phẩm yêu thích</p>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckoutDrawer({
  cart,
  draft,
  placedOrder,
  error,
  pending,
  authStatus,
  user,
  subtotal,
  onChange,
  onAuthSuccess,
  onSubmit,
  onClose,
  surface = "drawer",
}: {
  cart: CartLine[];
  draft: CheckoutDraft;
  placedOrder: ApiOrder | null;
  error: string | null;
  pending: boolean;
  authStatus: AuthStatus;
  user: AuthUser | null;
  subtotal: number;
  onChange: (draft: CheckoutDraft) => void;
  onAuthSuccess: () => void;
  onSubmit: () => void;
  onClose: () => void;
  surface?: "drawer" | "page";
}) {
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const isPage = surface === "page";

  if (placedOrder) {
    return (
      <div className="flex-1 overflow-auto p-5">
        <div className="mb-4 text-center">
          <PackageCheck className="mx-auto text-success" size={44} />
          <h3 className="mt-2 text-lg font-extrabold text-slate-950">Đặt hàng thành công</h3>
          <p className="mt-1 text-[13px] leading-5 text-muted">
            {placedOrder.status === "pending_payment"
              ? "Chuyển khoản theo hướng dẫn bên dưới, đơn sẽ được xử lý ngay khi nhận tiền."
              : "Đơn đã được thanh toán và đang được xử lý."}
          </p>
        </div>
        <OrderSummary order={placedOrder} compact={!isPage} />
        <Link
          href={`/kiem-tra-don-hang?code=${encodeURIComponent(placedOrder.code)}&email=${encodeURIComponent(placedOrder.customerEmail)}`}
          className="focus-ring mt-4 inline-flex h-11 w-full items-center justify-center rounded-md border border-border font-extrabold text-slate-800 transition hover:bg-slate-50"
          onClick={onClose}
        >
          Theo dõi đơn hàng
        </Link>
      </div>
    );
  }

  if (authStatus !== "authenticated" || !user) {
    return (
      <div className={isPage ? "p-6" : "flex-1 overflow-auto p-5"}>
        <div className={isPage ? "hidden" : "mb-4 rounded-md bg-surface-muted p-3 text-sm"}>
          <div className="flex justify-between font-extrabold">
            <span>{cart.length} sản phẩm</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
        </div>
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] font-semibold leading-5 text-amber-800">
          Đăng nhập hoặc tạo tài khoản để đặt hàng. Thông tin giao tài khoản sẽ lấy từ hồ sơ của bạn.
        </p>
        <div className="mb-5 grid grid-cols-2 rounded-md bg-slate-100 p-1 text-[13px] font-extrabold" role="tablist">
          {(
            [
              ["login", "Đăng nhập"],
              ["register", "Đăng ký"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={authTab === value}
              className={`focus-ring h-9 cursor-pointer rounded-[5px] transition ${
                authTab === value ? "bg-white text-primary-strong shadow-sm" : "text-slate-600"
              }`}
              onClick={() => setAuthTab(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {authTab === "login" ? (
          <LoginForm idPrefix="checkout-login" onSuccess={onAuthSuccess} />
        ) : (
          <RegisterForm idPrefix="checkout-register" onSuccess={onAuthSuccess} />
        )}
        {error ? (
          <p
            role="alert"
            className="mt-4 whitespace-pre-line rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-semibold leading-5 text-red-700"
          >
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  const paymentOptions: [PaymentMethod, string][] = [
    ["bank_transfer", "Chuyển khoản ACB / QR"],
    ["zalo", "Liên hệ Zalo để xác nhận"],
  ];

  return (
    <div className={isPage ? "p-6" : "flex-1 overflow-auto p-5"}>
      <div className={isPage ? "hidden" : "mb-4 rounded-md bg-surface-muted p-3 text-sm"}>
        <div className="flex justify-between font-extrabold">
          <span>{cart.length} sản phẩm</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
      </div>
      <div className="space-y-4">
        {isPage ? (
          <div>
            <h2 className="text-[20px] font-extrabold text-slate-950">Thông tin đặt hàng</h2>
            <p className="mt-1 text-[13px] text-muted">Đơn sẽ được lưu và giao theo email trong tài khoản này.</p>
          </div>
        ) : null}
        <div className="rounded-[8px] border border-emerald-100 bg-emerald-50/60 p-4 text-[13px]">
          <p className="text-[12px] font-bold uppercase text-slate-500">Tài khoản đặt hàng</p>
          <p className="mt-1 font-extrabold text-slate-950">{user.fullName}</p>
          <p className="mt-0.5 text-slate-600">{user.email}</p>
          {user.phone ? <p className="mt-0.5 text-slate-600">{user.phone}</p> : null}
        </div>
        <label className="block text-sm font-bold text-slate-800">
          Ghi chú
          <textarea
            className="mt-2 min-h-24 w-full rounded-md border border-border p-3 outline-none focus:border-primary"
            value={draft.note}
            disabled={pending}
            onChange={(event) => onChange({ ...draft, note: event.currentTarget.value })}
          />
        </label>
        <div className="grid gap-2">
          <p className="text-sm font-bold text-slate-800">Phương thức thanh toán</p>
          {paymentOptions.map(([value, label]) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center gap-3 rounded-[8px] border p-4 text-sm font-bold transition ${
                draft.paymentMethod === value
                  ? "border-primary bg-emerald-50 text-slate-950 shadow-sm"
                  : "border-border bg-white text-slate-800 hover:border-emerald-200"
              }`}
            >
              <input
                type="radio"
                checked={draft.paymentMethod === value}
                disabled={pending}
                onChange={() => onChange({ ...draft, paymentMethod: value })}
              />
              <span>
                {label}
                <span className="mt-0.5 block text-[12px] font-semibold text-muted">
                  {value === "bank_transfer"
                    ? "Tạo mã QR VietQR sau khi đặt đơn."
                    : "Dùng khi bạn muốn nhân viên xác nhận thủ công qua Zalo."}
                </span>
              </span>
            </label>
          ))}
        </div>
        {error ? (
          <p
            role="alert"
            className="whitespace-pre-line rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-semibold leading-5 text-red-700"
          >
            {error}
          </p>
        ) : null}
        <button
          className="h-12 w-full rounded-md bg-accent font-extrabold text-white disabled:opacity-50"
          type="button"
          disabled={pending || !cart.length}
          onClick={onSubmit}
        >
          {pending ? "Đang tạo đơn…" : "Đặt hàng & lấy mã QR"}
        </button>
      </div>
    </div>
  );
}
