import { describe, it, expect } from "vitest";
import { CsvRowSchema } from "@/lib/data/university-types";

const validRow = {
  name_en: "Test University",
  name_ru: "Тест Университет",
  name_tk: "Test Uni",
  country: "Turkey",
  city: "Istanbul",
  tuition_usd: "5000",
  moe_approved: "true",
  ranking_qs: "150",
  languages: "English|Turkish",
  majors: "Computer Science|Medicine",
  official_website: "https://test.edu",
  application_portal_url: "https://apply.test.edu",
  entrance_requirements: '{"turkey":{"yos":true}}',
};

describe("CsvRowSchema", () => {
  it("parses a fully valid row", () => {
    const result = CsvRowSchema.safeParse(validRow);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.tuition_usd).toBe(5000);
    expect(result.data.moe_approved).toBe(true);
    expect(result.data.ranking_qs).toBe(150);
    expect(result.data.languages).toEqual(["English", "Turkish"]);
    expect(result.data.majors).toEqual(["Computer Science", "Medicine"]);
    expect(result.data.entrance_requirements).toEqual({
      turkey: { yos: true },
    });
  });

  it("fails when name_en is empty", () => {
    const result = CsvRowSchema.safeParse({ ...validRow, name_en: "" });
    expect(result.success).toBe(false);
  });

  it("fails when name_ru is empty", () => {
    const result = CsvRowSchema.safeParse({ ...validRow, name_ru: "" });
    expect(result.success).toBe(false);
  });

  it("fails when name_tk is empty", () => {
    const result = CsvRowSchema.safeParse({ ...validRow, name_tk: "" });
    expect(result.success).toBe(false);
  });

  it("fails when tuition_usd is negative", () => {
    const result = CsvRowSchema.safeParse({ ...validRow, tuition_usd: "-100" });
    expect(result.success).toBe(false);
  });

  it("fails when tuition_usd is not a number", () => {
    const result = CsvRowSchema.safeParse({ ...validRow, tuition_usd: "abc" });
    expect(result.success).toBe(false);
  });

  it("accepts tuition_usd of zero", () => {
    const result = CsvRowSchema.safeParse({ ...validRow, tuition_usd: "0" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.tuition_usd).toBe(0);
  });

  it("treats blank tuition_usd_max as null", () => {
    const result = CsvRowSchema.safeParse({ ...validRow, tuition_usd_max: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.tuition_usd_max).toBeNull();
  });

  it("parses a valid tuition_usd range", () => {
    const result = CsvRowSchema.safeParse({
      ...validRow,
      tuition_usd: "5000",
      tuition_usd_max: "8000",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.tuition_usd_max).toBe(8000);
  });

  it("fails when tuition_usd_max is less than tuition_usd", () => {
    const result = CsvRowSchema.safeParse({
      ...validRow,
      tuition_usd: "5000",
      tuition_usd_max: "3000",
    });
    expect(result.success).toBe(false);
  });

  it('fails when moe_approved is not "true" or "false"', () => {
    const result = CsvRowSchema.safeParse({ ...validRow, moe_approved: "yes" });
    expect(result.success).toBe(false);
  });

  it('accepts moe_approved = "false" and converts to boolean false', () => {
    const result = CsvRowSchema.safeParse({
      ...validRow,
      moe_approved: "false",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.moe_approved).toBe(false);
  });

  it("accepts moe_approved case-insensitively (TRUE)", () => {
    const result = CsvRowSchema.safeParse({
      ...validRow,
      moe_approved: "TRUE",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.moe_approved).toBe(true);
  });

  it("treats blank ranking_qs as null", () => {
    const result = CsvRowSchema.safeParse({ ...validRow, ranking_qs: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.ranking_qs).toBeNull();
  });

  it("fails when ranking_qs is zero", () => {
    const result = CsvRowSchema.safeParse({ ...validRow, ranking_qs: "0" });
    expect(result.success).toBe(false);
  });

  it("fails when ranking_qs is negative", () => {
    const result = CsvRowSchema.safeParse({ ...validRow, ranking_qs: "-5" });
    expect(result.success).toBe(false);
  });

  it("splits pipe-separated languages and trims whitespace", () => {
    const result = CsvRowSchema.safeParse({
      ...validRow,
      languages: "English | Turkish | German",
    });
    expect(result.success).toBe(true);
    if (result.success)
      expect(result.data.languages).toEqual(["English", "Turkish", "German"]);
  });

  it("splits pipe-separated majors", () => {
    const result = CsvRowSchema.safeParse({
      ...validRow,
      majors: "CS|Law|Medicine",
    });
    expect(result.success).toBe(true);
    if (result.success)
      expect(result.data.majors).toEqual(["CS", "Law", "Medicine"]);
  });

  it("fails when official_website is not a valid URL", () => {
    const result = CsvRowSchema.safeParse({
      ...validRow,
      official_website: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("fails when application_portal_url is not a valid URL", () => {
    const result = CsvRowSchema.safeParse({
      ...validRow,
      application_portal_url: "just-text",
    });
    expect(result.success).toBe(false);
  });

  it("fails when entrance_requirements is invalid JSON", () => {
    const result = CsvRowSchema.safeParse({
      ...validRow,
      entrance_requirements: "{invalid}",
    });
    expect(result.success).toBe(false);
  });

  it("treats blank entrance_requirements as empty object", () => {
    const result = CsvRowSchema.safeParse({
      ...validRow,
      entrance_requirements: "",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.entrance_requirements).toEqual({});
  });
});
