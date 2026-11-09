export interface CreateCustomerDto {
  name: string;
  phone: string;
  email?: string;
}

export interface UpdateCustomerDto {
  name?: string;
  phone?: string;
  email?: string;
}

/**
 * POST /customers is find-or-create by exact E.164 `phone` within the active business.
 * - 201: a new customer was created.
 * - 200: a customer with that phone already exists in the business; it is returned unchanged
 *   (the submitted `name`/`email` are NOT applied). Oldest row wins if legacy duplicates exist.
 * Phones are never deduplicated across businesses. `name` is trimmed before validation (1-120 chars).
 * GET /customers?q= takes at most one string `q`; repeated/non-string `q` is 400.
 */
export type CreateCustomerResponse = { id: string; name: string; phone: string; email: string | null };
