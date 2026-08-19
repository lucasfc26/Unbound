import type { Prisma } from '@prisma/client';
import type { PrismaService } from './prisma.service';

/**
 * Runs `fn` inside a transaction with `app.current_user_id` set for the duration of that
 * transaction, so RLS policies on tables like `user_settings` can enforce
 * `userId = current_setting('app.current_user_id')` for writes. Must wrap every write to
 * such a table — a plain `prisma.userSettings.update(...)` outside this helper hits a
 * FORCE ROW LEVEL SECURITY table with no session variable set, which the policy always
 * denies.
 */
export function withUserContext<T>(
  prisma: PrismaService,
  userId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
    return fn(tx);
  });
}
