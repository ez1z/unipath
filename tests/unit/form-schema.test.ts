import { describe, it, expect } from 'vitest';
import { FormSchema } from '@/lib/data/university-schema';

const validForm = {
  name_en: 'Test University',
  name_ru: 'Тест Университет',
  name_tk: 'Test Uni',
  country: 'Turkey',
  city: 'Istanbul',
  tuition_usd: '5000',
  languages: 'English|Turkish',
  majors: 'Computer Science|Engineering',
  official_website: 'https://test.edu',
  application_portal_url: 'https://apply.test.edu',
};

describe('FormSchema', () => {
  it('parses a valid form submission', () => {
    const result = FormSchema.safeParse(validForm);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.tuition_usd).toBe(5000);
    expect(result.data.languages).toEqual(['English', 'Turkish']);
    expect(result.data.majors).toEqual(['Computer Science', 'Engineering']);
  });

  it('fails when name_en is missing', () => {
    const result = FormSchema.safeParse({ ...validForm, name_en: '' });
    expect(result.success).toBe(false);
  });

  it('fails when name_ru is missing', () => {
    const result = FormSchema.safeParse({ ...validForm, name_ru: '' });
    expect(result.success).toBe(false);
  });

  it('fails when name_tk is missing', () => {
    const result = FormSchema.safeParse({ ...validForm, name_tk: '' });
    expect(result.success).toBe(false);
  });

  it('fails when country is missing', () => {
    const result = FormSchema.safeParse({ ...validForm, country: '' });
    expect(result.success).toBe(false);
  });

  it('fails when city is missing', () => {
    const result = FormSchema.safeParse({ ...validForm, city: '' });
    expect(result.success).toBe(false);
  });

  it('fails when tuition_usd is negative', () => {
    const result = FormSchema.safeParse({ ...validForm, tuition_usd: '-1' });
    expect(result.success).toBe(false);
  });

  it('accepts tuition_usd of zero', () => {
    const result = FormSchema.safeParse({ ...validForm, tuition_usd: '0' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.tuition_usd).toBe(0);
  });

  it('converts moe_approved checkbox value "true" to boolean true', () => {
    const result = FormSchema.safeParse({ ...validForm, moe_approved: 'true' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.moe_approved).toBe(true);
  });

  it('converts absent moe_approved (unchecked) to boolean false', () => {
    const result = FormSchema.safeParse(validForm);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.moe_approved).toBe(false);
  });

  it('treats blank ranking_qs as null', () => {
    const result = FormSchema.safeParse({ ...validForm, ranking_qs: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.ranking_qs).toBeNull();
  });

  it('parses valid ranking_qs integer', () => {
    const result = FormSchema.safeParse({ ...validForm, ranking_qs: '200' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.ranking_qs).toBe(200);
  });

  it('treats invalid ranking_qs as null (not a hard error)', () => {
    const result = FormSchema.safeParse({ ...validForm, ranking_qs: 'abc' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.ranking_qs).toBeNull();
  });

  it('fails when languages is empty', () => {
    const result = FormSchema.safeParse({ ...validForm, languages: '' });
    expect(result.success).toBe(false);
  });

  it('fails when majors is empty', () => {
    const result = FormSchema.safeParse({ ...validForm, majors: '' });
    expect(result.success).toBe(false);
  });

  it('splits pipe-separated languages', () => {
    const result = FormSchema.safeParse({ ...validForm, languages: 'English|Russian|Turkish' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.languages).toEqual(['English', 'Russian', 'Turkish']);
  });

  it('fails when official_website is not a URL', () => {
    const result = FormSchema.safeParse({ ...validForm, official_website: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('fails when application_portal_url is not a URL', () => {
    const result = FormSchema.safeParse({ ...validForm, application_portal_url: 'bad' });
    expect(result.success).toBe(false);
  });

  it('treats blank entrance_requirements as empty object', () => {
    const result = FormSchema.safeParse({ ...validForm, entrance_requirements: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.entrance_requirements).toEqual({});
  });

  it('fails on invalid JSON in entrance_requirements', () => {
    const result = FormSchema.safeParse({ ...validForm, entrance_requirements: '{bad json}' });
    expect(result.success).toBe(false);
  });

  it('parses valid JSON entrance_requirements', () => {
    const result = FormSchema.safeParse({
      ...validForm,
      entrance_requirements: '{"turkey":{"yos":true}}',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.entrance_requirements).toEqual({ turkey: { yos: true } });
  });
});
