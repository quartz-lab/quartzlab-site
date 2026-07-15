export async function onRequest(context) {
  const assetUrl = new URL('/docs-shell', context.request.url);
  return context.env.ASSETS.fetch(new Request(assetUrl.toString(), context.request));
}
