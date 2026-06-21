import { z } from 'zod';

// Schema for property details used in AI generation
export const propertyDetailsSchema = z.object({
  title: z.string().optional(),
  propertyType: z.string().optional(),
  location: z.string().optional(),
  locality: z.string().optional(),
  city: z.string().optional(),
  bhk: z.string().optional(),
  bedrooms: z.number().or(z.string()).optional(),
  price: z.string().or(z.number()).optional(),
  area: z.string().or(z.number()).optional(),
  keywords: z.string().optional()
});

export type PropertyDetails = z.infer<typeof propertyDetailsSchema>;

// Auto-write API response schema
export const autoWriteResponseSchema = z.object({
  description: z.string()
});
