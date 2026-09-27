import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module.js';
import { Category } from './../src/catalog/entities/category.entity.js';
import { Product } from './../src/catalog/entities/product.entity.js';
import { Order } from './../src/orders/entities/order.entity.js';
import { Promotion } from './../src/promotions/entities/promotion.entity.js';
import { User } from './../src/users/entities/user.entity.js';

/**
 * Full commerce flow against the MySQL from `.env`:
 * admin creates category/product/variants, stocks the auto SKU, a guest checks out with a promo
 * code, admin confirms payment and completes the order, the guest looks it up and receives the
 * credentials. Everything created here is removed in afterAll.
 */
describe('Commerce (e2e)', () => {
  let app: INestApplication<App>;
  let http: () => request.Agent;
  let adminToken = '';
  const stamp = Date.now();
  const customerEmail = `commerce-${stamp}@example.com`;
  const promoCode = `E2E${stamp.toString().slice(-6)}`;

  let categoryId = 0;
  let productId = 0;
  let productSlug = '';
  let autoVariantId = 0;
  let manualVariantId = 0;
  let orderId = 0;
  let orderCode = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    http = () => request(app.getHttpServer());

    const login = await http()
      .post('/api/auth/login')
      .send({ email: 'admin@aihub.local', password: 'Admin@12345' })
      .expect(200);
    adminToken = login.body.tokens.accessToken;
  });

  afterAll(async () => {
    const ds = app.get(DataSource);
    if (orderId) await ds.getRepository(Order).delete({ id: orderId });
    if (productId) await ds.getRepository(Product).delete({ id: productId });
    if (categoryId) await ds.getRepository(Category).delete({ id: categoryId });
    await ds.getRepository(Promotion).delete({ code: promoCode });
    await ds.getRepository(User).delete({ email: customerEmail });
    await app.close();
  });

  const asAdmin = (req: request.Test) =>
    req.set('Authorization', `Bearer ${adminToken}`);

  it('admin creates a category', async () => {
    const res = await asAdmin(http().post('/api/admin/categories'))
      .send({ name: `Danh mục E2E ${stamp}`, icon: 'Bot' })
      .expect(201);
    categoryId = res.body.id;
    expect(res.body.slug).toBe(`danh-muc-e2e-${stamp}`);
    expect(res.body.path).toBe(res.body.slug);
  });

  it('public category tree does not require auth', async () => {
    const res = await http().get('/api/categories').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('admin creates a product with an auto and a manual variant', async () => {
    const res = await asAdmin(http().post('/api/admin/products'))
      .send({
        name: `Tài khoản E2E ${stamp}`,
        status: 'active',
        categoryIds: [categoryId],
        badges: ['Sale'],
        warrantyDays: 30,
        variants: [
          {
            name: 'Dùng chung · 1 tháng',
            accountType: 'Dùng chung',
            duration: '1 tháng',
            price: 100000,
            regularPrice: 200000,
            deliveryType: 'auto',
          },
          {
            name: 'Chính chủ · 1 tháng',
            accountType: 'Chính chủ',
            duration: '1 tháng',
            price: 300000,
            deliveryType: 'manual',
          },
        ],
      })
      .expect(201);
    productId = res.body.id;
    productSlug = res.body.slug;
    expect(res.body.variants).toHaveLength(2);
    autoVariantId = res.body.variants.find(
      (v: { deliveryType: string }) => v.deliveryType === 'auto',
    ).id;
    manualVariantId = res.body.variants.find(
      (v: { deliveryType: string }) => v.deliveryType === 'manual',
    ).id;
  });

  it('storefront lists and filters the product by category', async () => {
    const res = await http()
      .get('/api/products')
      .query({ category: `danh-muc-e2e-${stamp}`, sort: 'price_asc' })
      .expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].slug).toBe(productSlug);
    expect(res.body.items[0].variants).toHaveLength(2);

    const detail = await http().get(`/api/products/${productSlug}`).expect(200);
    expect(detail.body.categories[0].id).toBe(categoryId);
  });

  it('admin endpoints reject anonymous callers', async () => {
    await http().get('/api/admin/products').expect(401);
    await http().post('/api/admin/products').send({ name: 'x' }).expect(401);
  });

  it('checkout fails while the auto SKU has no stock', async () => {
    const res = await http()
      .post('/api/orders')
      .send({
        customer: {
          name: 'Khách E2E',
          phone: '0931729316',
          email: customerEmail,
        },
        paymentMethod: 'bank_transfer',
        items: [{ variantId: autoVariantId, quantity: 1 }],
      })
      .expect(409);
    expect(res.body.message).toContain('chỉ còn 0');
  });

  it('admin stocks the auto SKU and sees available count', async () => {
    const res = await asAdmin(
      http().post(`/api/admin/variants/${autoVariantId}/inventory`),
    )
      .send({
        items: ['e2e-user-1@mail.test|pass1', 'e2e-user-2@mail.test|pass2'],
        note: 'e2e',
      })
      .expect(201);
    expect(res.body).toEqual({ imported: 2, available: 2 });

    const admin = await asAdmin(
      http().get(`/api/admin/products/${productId}`),
    ).expect(200);
    const auto = admin.body.variants.find(
      (v: { id: number }) => v.id === autoVariantId,
    );
    expect(auto.stock).toEqual({ available: 2, reserved: 0 });
  });

  it('admin creates a 10% promotion code', async () => {
    await asAdmin(http().post('/api/admin/promotions'))
      .send({
        name: 'E2E promo',
        code: promoCode,
        type: 'percent',
        value: 10,
        usageLimit: 5,
      })
      .expect(201);
  });

  it('guest checks out with the promo code and gets bank instructions', async () => {
    const res = await http()
      .post('/api/orders')
      .send({
        customer: {
          name: 'Khách E2E',
          phone: '0931 729 316',
          email: customerEmail,
        },
        paymentMethod: 'bank_transfer',
        note: 'giao nhanh giúp mình',
        promotionCode: promoCode.toLowerCase(),
        items: [
          { variantId: autoVariantId, quantity: 1 },
          { variantId: manualVariantId, quantity: 1 },
        ],
      })
      .expect(201);

    orderId = res.body.id;
    orderCode = res.body.code;
    expect(orderCode).toMatch(/^AH\d+$/);
    expect(res.body.status).toBe('pending_payment');
    expect(res.body.subtotal).toBe(400000);
    expect(res.body.discountTotal).toBe(40000);
    expect(res.body.total).toBe(360000);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.paymentInstructions.transferContent).toBe(orderCode);
    expect(res.body.paymentInstructions.amount).toBe(360000);
  });

  it('guest can look the order up with code + email only', async () => {
    await http()
      .get('/api/orders/lookup')
      .query({ code: orderCode, email: 'wrong@example.com' })
      .expect(404);
    const res = await http()
      .get('/api/orders/lookup')
      .query({ code: `#${orderCode.toLowerCase()}`, email: customerEmail })
      .expect(200);
    expect(res.body.code).toBe(orderCode);
    expect(res.body.paymentInstructions).not.toBeNull();
  });

  it('completing before payment is rejected', async () => {
    await asAdmin(http().post(`/api/admin/orders/${orderId}/complete`))
      .send({})
      .expect(409);
  });

  it('admin confirms the bank transfer', async () => {
    const res = await asAdmin(
      http().post(`/api/admin/orders/${orderId}/confirm-payment`),
    )
      .send({ transactionRef: 'ACB-123' })
      .expect(201);
    expect(res.body.status).toBe('processing');
    expect(res.body.payments[0].status).toBe('paid');
  });

  it('completing requires a delivery note for the manual line', async () => {
    const res = await asAdmin(
      http().post(`/api/admin/orders/${orderId}/complete`),
    )
      .send({})
      .expect(400);
    expect(res.body.message).toContain('deliveryNotes');
  });

  it('admin completes the order: stock unit is delivered, manual note recorded', async () => {
    const detail = await asAdmin(
      http().get(`/api/admin/orders/${orderId}`),
    ).expect(200);
    const manualLine = detail.body.items.find(
      (i: { variantId: number }) => i.variantId === manualVariantId,
    );

    const res = await asAdmin(
      http().post(`/api/admin/orders/${orderId}/complete`),
    )
      .send({
        deliveryNotes: { [manualLine.id]: 'Đã nâng cấp trên email của khách' },
      })
      .expect(201);
    expect(res.body.status).toBe('completed');

    const autoLine = res.body.items.find(
      (i: { variantId: number }) => i.variantId === autoVariantId,
    );
    expect(autoLine.deliveryStatus).toBe('delivered');
    expect(autoLine.inventoryItems).toHaveLength(1);
    expect(autoLine.inventoryItems[0].payload).toBe(
      'e2e-user-1@mail.test|pass1',
    );
    expect(autoLine.warrantyUntil).not.toBeNull();

    const stock = await asAdmin(
      http().get(`/api/admin/products/${productId}`),
    ).expect(200);
    const auto = stock.body.variants.find(
      (v: { id: number }) => v.id === autoVariantId,
    );
    expect(auto.stock.available).toBe(1);

    const product = await http()
      .get(`/api/products/${productSlug}`)
      .expect(200);
    expect(product.body.soldCount).toBe(2);
  });

  it('guest lookup now shows the delivered credentials', async () => {
    const res = await http()
      .get('/api/orders/lookup')
      .query({ code: orderCode, email: customerEmail })
      .expect(200);
    expect(res.body.status).toBe('completed');
    expect(res.body.paymentInstructions).toBeNull();
    const autoLine = res.body.items.find(
      (i: { variantId: number }) => i.variantId === autoVariantId,
    );
    expect(autoLine.inventoryItems[0].payload).toBe(
      'e2e-user-1@mail.test|pass1',
    );
  });

  it('promotion usage was counted', async () => {
    const res = await asAdmin(http().get('/api/admin/promotions')).expect(200);
    const promo = res.body.items.find(
      (p: { code: string }) => p.code === promoCode,
    );
    expect(promo.usageCount).toBe(1);
  });

  it('a signed-in customer can pay from the wallet after an approved deposit', async () => {
    const reg = await http()
      .post('/api/auth/register')
      .send({
        email: customerEmail,
        password: 'Secret@12345',
        fullName: 'Khách E2E',
      })
      .expect(201);
    const token = reg.body.tokens.accessToken;
    const asCustomer = (req: request.Test) =>
      req.set('Authorization', `Bearer ${token}`);

    const deposit = await asCustomer(http().post('/api/wallet/fund-requests'))
      .send({ type: 'deposit', amount: 500000 })
      .expect(201);
    expect(deposit.body.transferContent).toBe(`NAP ${deposit.body.code}`);

    await asAdmin(
      http().post(`/api/admin/fund-requests/${deposit.body.id}/approve`),
    )
      .send({})
      .expect(201);
    const wallet = await asCustomer(http().get('/api/wallet')).expect(200);
    expect(wallet.body.balance).toBe(500000);

    const order = await asCustomer(http().post('/api/orders'))
      .send({
        customer: {
          name: 'Khách E2E',
          phone: '0931729316',
          email: customerEmail,
        },
        paymentMethod: 'wallet',
        items: [{ variantId: autoVariantId, quantity: 1 }],
      })
      .expect(201);
    expect(order.body.status).toBe('processing');
    expect(order.body.paymentInstructions).toBeNull();

    const after = await asCustomer(http().get('/api/wallet')).expect(200);
    expect(after.body.balance).toBe(400000);

    const mine = await asCustomer(http().get('/api/orders/me')).expect(200);
    expect(mine.body.items.map((o: { code: string }) => o.code)).toContain(
      order.body.code,
    );

    // Cancelling a wallet-paid order refunds the balance.
    await asAdmin(http().post(`/api/admin/orders/${order.body.id}/cancel`))
      .send({ reason: 'e2e' })
      .expect(201);
    const refunded = await asCustomer(http().get('/api/wallet')).expect(200);
    expect(refunded.body.balance).toBe(500000);

    await app
      .get(DataSource)
      .getRepository(Order)
      .delete({ id: order.body.id });
  });
});
