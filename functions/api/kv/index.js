export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const prefix = url.searchParams.get("prefix");
  if (!prefix) {
    return Response.json({ error: "prefix query param required" }, { status: 400 });
  }
  // serverNow lets callers (e.g. presence freshness checks) compare two
  // timestamps that both came from this same clock, instead of comparing
  // a client's own clock against another device's — which drifts across
  // phones/timezones and produces false "offline" reads.
  const [{ results }, nowRow] = await Promise.all([
    env.DB.prepare("SELECT key, value, updated_at FROM kv WHERE key LIKE ? || '%'").bind(prefix).all(),
    env.DB.prepare("SELECT datetime('now') AS now").first(),
  ]);
  return Response.json({
    entries: results.map((r) => ({ key: r.key, value: r.value, updatedAt: r.updated_at })),
    serverNow: nowRow.now,
  });
}
