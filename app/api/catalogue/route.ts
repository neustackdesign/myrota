/** Real catalogue intentionally returns no unreviewed/sketchy "matches".
 * Local/imported SKU ingestion and verified provenance are Gate 2.
 */
export async function GET() {
  return Response.json({ results: [] }, { headers: { "cache-control": "no-store" } });
}
