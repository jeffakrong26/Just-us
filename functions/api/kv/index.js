export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const prefix = url.searchParams.get("prefix");
  if (!prefix) {
    return Response.json({ error: "prefix query param required" }, { status: 400 });
  }
  const { results } = await env.DB.prepare("SELECT key, value FROM kv WHERE key LIKE ? || '%'")
    .bind(prefix)
    .all();
  return Response.json({ entries: results.map((r) => ({ key: r.key, value: r.value })) });
}
