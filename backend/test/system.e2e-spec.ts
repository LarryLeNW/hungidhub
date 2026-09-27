import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module.js';
import { ProductReview } from './../src/catalog/entities/product-review.entity.js';
import { ContentBlock } from './../src/content/entities/content-block.entity.js';
import { SupportTicket } from './../src/support/entities/support-ticket.entity.js';
import { Notification } from './../src/system/entities/notification.entity.js';
import { Report } from './../src/system/entities/report.entity.js';

/** Covers the admin/system endpoints that replaced the last mock data on the client. */
describe('System, reviews, support, content (e2e)', () => {
  let app: INestApplication<App>;
  let http: () => request.Agent;
  let adminToken = '';
  const stamp = Date.now();
  let productSlug = '';
  let reviewId = 0;
  let ticketId = 0;
  let blockId = 0;
  let reportId = 0;

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

    const products = await http()
      .get('/api/products')
      .query({ limit: 1 })
      .expect(200);
    productSlug = products.body.items[0]?.slug ?? '';
  });

  afterAll(async () => {
    const ds = app.get(DataSource);
    if (reviewId)
      await ds.getRepository(ProductReview).delete({ id: reviewId });
    if (ticketId)
      await ds.getRepository(SupportTicket).delete({ id: ticketId });
    if (blockId) await ds.getRepository(ContentBlock).delete({ id: blockId });
    if (reportId) await ds.getRepository(Report).delete({ id: reportId });
    await ds
      .getRepository(Notification)
      .delete({ entityType: 'support_ticket', entityId: ticketId });
    await app.close();
  });

  const asAdmin = (req: request.Test) =>
    req.set('Authorization', `Bearer ${adminToken}`);

  it('public settings expose hotline and home sections but not bank details', async () => {
    const res = await http().get('/api/settings/public').expect(200);
    expect(res.body['store.hotline']).toBe('0931 729 316');
    expect(Array.isArray(res.body['home.sections'])).toBe(true);
    expect(res.body['payment.bank']).toBeUndefined();
  });

  it('admin can update a setting', async () => {
    const res = await asAdmin(http().put('/api/admin/settings/store.tagline'))
      .send({ value: `Tagline ${stamp}` })
      .expect(200);
    expect(res.body.value).toBe(`Tagline ${stamp}`);
    await asAdmin(http().put('/api/admin/settings/store.tagline'))
      .send({ value: 'Tài khoản số giá tốt' })
      .expect(200);
  });

  it('admin stats return the overview shape', async () => {
    const res = await asAdmin(http().get('/api/admin/stats')).expect(200);
    expect(res.body.revenueByDay).toHaveLength(12);
    expect(typeof res.body.today.revenue).toBe('number');
    expect(res.body.badges).toEqual(
      expect.objectContaining({
        orders: expect.any(Number),
        support: expect.any(Number),
      }),
    );
  });

  it('a submitted review is pending until approved, then updates the product rating', async () => {
    expect(productSlug).toBeTruthy();
    const created = await http()
      .post(`/api/products/${productSlug}/reviews`)
      .send({
        authorName: 'E2E',
        rating: 5,
        content: 'Tài khoản dùng ổn định.',
      })
      .expect(201);
    reviewId = created.body.id;
    expect(created.body.status).toBe('pending');

    const before = await http()
      .get(`/api/products/${productSlug}/reviews`)
      .expect(200);
    expect(
      before.body.items.some((r: { id: number }) => r.id === reviewId),
    ).toBe(false);

    await asAdmin(http().patch(`/api/admin/reviews/${reviewId}/status`))
      .send({ status: 'approved' })
      .expect(200);
    const after = await http()
      .get(`/api/products/${productSlug}/reviews`)
      .expect(200);
    expect(
      after.body.items.some((r: { id: number }) => r.id === reviewId),
    ).toBe(true);
    expect(after.body.summary.reviewCount).toBeGreaterThanOrEqual(1);

    await asAdmin(http().patch(`/api/admin/reviews/${reviewId}/status`))
      .send({ status: 'rejected' })
      .expect(200);
  });

  it('guest opens a support ticket, admin replies and closes it, a notification is raised', async () => {
    const created = await http()
      .post('/api/support/tickets')
      .send({
        customerName: 'Khách E2E',
        customerEmail: `support-${stamp}@example.com`,
        subject: 'Chưa nhận được tài khoản',
        message:
          'Mình đã chuyển khoản 10 phút trước nhưng chưa thấy tài khoản.',
        priority: 'high',
      })
      .expect(201);
    ticketId = created.body.id;
    expect(created.body.code).toMatch(/^TK-\d+$/);
    expect(created.body.messages).toHaveLength(1);

    const notifications = await asAdmin(
      http().get('/api/admin/notifications'),
    ).expect(200);
    expect(
      notifications.body.items.some(
        (n: { entityId: number }) => n.entityId === ticketId,
      ),
    ).toBe(true);

    await asAdmin(
      http().post(`/api/admin/support/tickets/${ticketId}/messages`),
    )
      .send({ body: 'Mình kiểm tra ngay nhé.' })
      .expect(201);
    const closed = await asAdmin(
      http().patch(`/api/admin/support/tickets/${ticketId}`),
    )
      .send({ status: 'closed' })
      .expect(200);
    expect(closed.body.status).toBe('closed');
    expect(closed.body.messages).toHaveLength(2);
  });

  it('admin manages content blocks and the storefront sees published ones', async () => {
    const created = await asAdmin(http().post('/api/admin/content/blocks'))
      .send({
        title: `Banner E2E ${stamp}`,
        type: 'banner',
        placement: 'home',
        imageUrl: 'https://example.com/b.jpg',
        status: 'draft',
      })
      .expect(201);
    blockId = created.body.id;

    const hidden = await http().get('/api/content-blocks/home').expect(200);
    expect(hidden.body.some((b: { id: number }) => b.id === blockId)).toBe(
      false,
    );

    await asAdmin(http().patch(`/api/admin/content/blocks/${blockId}`))
      .send({ status: 'published' })
      .expect(200);
    const shown = await http().get('/api/content-blocks/home').expect(200);
    expect(shown.body.some((b: { id: number }) => b.id === blockId)).toBe(true);
    expect(shown.body.length).toBeGreaterThanOrEqual(5); // seeded banners + this one
  });

  it('inventory and transactions admin lists respond', async () => {
    const inventory = await asAdmin(http().get('/api/admin/inventory'))
      .query({ limit: 5 })
      .expect(200);
    expect(inventory.body.items[0]).toEqual(
      expect.objectContaining({
        sku: expect.any(String),
        available: expect.any(Number),
      }),
    );
    await asAdmin(http().get('/api/admin/transactions')).expect(200);
    const categories = await asAdmin(
      http().get('/api/admin/categories'),
    ).expect(200);
    expect(typeof categories.body[0].productCount).toBe('number');
  });

  it('admin generates a report synchronously', async () => {
    const res = await asAdmin(http().post('/api/admin/reports'))
      .send({
        kind: 'revenue_by_product',
        periodStart: '2026-08-01T00:00:00Z',
        periodEnd: '2026-08-31T23:59:59Z',
      })
      .expect(201);
    reportId = res.body.id;
    expect(res.body.status).toBe('ready');
    expect(Array.isArray(res.body.params.result)).toBe(true);
  });

  it('customers list carries order counts', async () => {
    const res = await asAdmin(http().get('/api/users'))
      .query({ role: 'customer', limit: 5 })
      .expect(200);
    for (const user of res.body.items) {
      expect(typeof user.orderCount).toBe('number');
      expect(typeof user.totalSpent).toBe('number');
    }
  });
});
