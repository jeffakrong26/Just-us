export async function onRequestGet({ params, env }) {
  const key = decodeURIComponent(params.key);
  const row = await env.DB.prepare("SELECT key, value, updated_at FROM kv WHERE key = ?").bind(key).first();
  return Response.json({ key, value: row ? row.value : null, updatedAt: row ? row.updated_at : null });
}

export async function onRequestPut({ params, env, request }) {
  const key = decodeURIComponent(params.key);
  const body = await request.json();
  const value = typeof body.value === "string" ? body.value : JSON.stringify(body.value);
  await env.DB.prepare(
    `INSERT INTO kv (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  )
    .bind(key, value)
    .run();
  return Response.json({ key, value });
}
