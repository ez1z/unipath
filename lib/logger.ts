import { createServiceClient } from '@/lib/supabase/service';

type Level = 'error' | 'warn' | 'info';

export async function logError(
  context: string,
  message: string,
  details?: Record<string, unknown>,
): Promise<void> {
  await log('error', context, message, details);
}

export async function logWarn(
  context: string,
  message: string,
  details?: Record<string, unknown>,
): Promise<void> {
  await log('warn', context, message, details);
}

async function log(
  level: Level,
  context: string,
  message: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    const service = createServiceClient();
    await service.from('system_logs').insert({
      level,
      context,
      message,
      details: details ?? null,
    });
  } catch {
    // Never let logging block the caller
  }
}
