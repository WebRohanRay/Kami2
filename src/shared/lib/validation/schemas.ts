import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim()
    .min(1, 'Please enter your email address.')
    .email('Please enter a valid email address.'),
  password: z.string().min(1, 'Please enter your password.'),
});

export const signUpSchema = z.object({
  name: z.string().trim()
    .min(1, 'Please enter your name.')
    .max(50, 'Name must be less than 50 characters.'),
  email: z.string().trim()
    .min(1, 'Please enter your email address.')
    .email('Please enter a valid email address.'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters.')
    .refine((val) => /[A-Z]/.test(val), { message: 'Password must contain at least one uppercase letter.' })
    .refine((val) => /[0-9!@#$%^&*]/.test(val), { message: 'Password must contain at least one number or symbol.' }),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim()
    .min(1, 'Please enter your email address.')
    .email('Please enter a valid email address.'),
});

export const resetPasswordSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters.')
    .refine((val) => /[A-Z]/.test(val), { message: 'Password must contain at least one uppercase letter.' })
    .refine((val) => /[0-9!@#$%^&*]/.test(val), { message: 'Password must contain at least one number or symbol.' }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
});

// Profile update schemas
export const profileSchema = z.object({
  nickname: z.string().trim()
    .min(2, 'Display name must be at least 2 characters.')
    .max(30, 'Display name must be less than 30 characters.'),
});

// Journal schema
export const journalSchema = z.object({
  title: z.string().trim().max(100, 'Title must be less than 100 characters.').optional().nullable(),
  body: z.string().trim()
    .min(1, 'Body cannot be empty.')
    .max(10000, 'Body must be less than 10,000 characters.'),
});

// Goal schema
export const goalSchema = z.object({
  title: z.string().trim()
    .min(1, 'Goal title cannot be empty.')
    .max(100, 'Goal title must be less than 100 characters.'),
  description: z.string().trim().max(500, 'Description must be less than 500 characters.').optional().nullable(),
});

// Memory schema
export const memorySchema = z.object({
  title: z.string().trim()
    .min(1, 'Title cannot be empty.')
    .max(100, 'Title must be less than 100 characters.'),
  description: z.string().trim().max(500, 'Description must be less than 500 characters.').optional().nullable(),
});

// Future letter schema
export const futureLetterSchema = z.object({
  subject: z.string().trim()
    .min(1, 'Subject cannot be empty.')
    .max(100, 'Subject must be less than 100 characters.'),
  body: z.string().trim()
    .min(1, 'Body cannot be empty.')
    .max(10000, 'Body must be less than 10,000 characters.'),
  deliverAt: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid delivery date.' }),
});
