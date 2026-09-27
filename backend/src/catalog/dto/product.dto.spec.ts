import 'reflect-metadata';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateProductDto } from './product.dto.js';

async function featuredImageErrors(featuredImage: string) {
  const dto = Object.assign(new CreateProductDto(), {
    name: 'Test product',
    featuredImage,
  });
  return validate(dto);
}

describe('CreateProductDto featuredImage', () => {
  it.each([
    '/uploads/images/product.webp',
    'https://cdn.example.com/products/product.webp',
  ])('accepts a public image location: %s', async (featuredImage) => {
    expect(await featuredImageErrors(featuredImage)).toHaveLength(0);
  });

  it('rejects a non-public image location', async () => {
    const errors = await featuredImageErrors('product.webp');
    expect(errors.some((error) => error.property === 'featuredImage')).toBe(true);
  });
});
