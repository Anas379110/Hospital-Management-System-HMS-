import { z } from 'zod';

export const patientSchema = z.object({
  fullName: z.string().trim().min(3),
  dateOfBirth: z.iso.date(),
  gender: z.enum(['male', 'female']),
  phone: z.string().trim().min(6),
  nationalId: z.string().optional(),
  address: z.string().optional(),
});
