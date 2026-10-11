import { handleUpload } from '@vercel/blob/client'

// Issues short-lived tokens so the browser can upload customer artwork straight to
// private Blob storage (avoids the 4.5 MB function body limit for 10 MB uploads).
export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!/^artwork\/[\w.-]+$/.test(pathname)) throw new Error('Invalid upload path')
        return {
          allowedContentTypes: ['image/png', 'image/jpeg', 'image/svg+xml'],
          maximumSizeInBytes: 10 * 1024 * 1024,
          addRandomSuffix: true,
        }
      },
    })
    return Response.json(result)
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 })
  }
}
