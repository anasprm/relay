/**
 * Publishes an event to a conversation's Realtime Broadcast channel using the
 * service-role secret.
 *
 * Broadcast is used instead of `postgres_changes` because Relay authenticates
 * with a custom JWT rather than Supabase Auth: `auth.uid()` is null for
 * subscribers, so RLS filters every Postgres change event out. Broadcast
 * messages are not subject to RLS.
 */
export async function broadcastToConversation(
  conversationId: string,
  event: string,
  payload: unknown,
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  try {
    const response = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: `conversation:${conversationId}`,
            event,
            payload,
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error(`[realtime] ${event} broadcast failed`, response.status, detail);
    }
  } catch (error) {
    console.error(`[realtime] ${event} broadcast error`, error);
  }
}
