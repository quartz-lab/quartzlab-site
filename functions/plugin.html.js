export async function onRequest(context) {
  const assetUrl = new URL('/plugin-shell', context.request.url);
  return context.env.ASSETS.fetch(new Request(assetUrl.toString(), context.request));
}
