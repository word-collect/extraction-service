import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { Readable } from 'node:stream'

const s3 = new S3Client({})

export const handler = async (event: {
  detail: { bucket: { name: string }; object: { key: string } }
}) => {
  const { bucket, object } = event.detail

  const resp = await s3.send(
    new GetObjectCommand({ Bucket: bucket.name, Key: object.key })
  )

  // stream → Buffer
  const chunks: Buffer[] = []
  for await (const chunk of resp.Body as Readable) chunks.push(chunk as Buffer)
  let fileBuf = Buffer.concat(chunks)

  /* --- derive format -------------------------------------------------- */
  // Prefer the S3 object's Content-Type, if present
  const ct = resp.ContentType ?? ''
  const fmtFromCT = ct.includes('html')
    ? 'html'
    : ct.includes('markdown')
    ? 'md'
    : ct.includes('pdf')
    ? 'pdf'
    : ct.includes('text')
    ? 'txt'
    : ''

  const format = fmtFromCT || 'txt'

  const isText = ['html', 'md', 'txt', 'csv', 'json'].includes(format)

  if (isText) {
    // strip UTF-8 BOM + leading whitespace
    fileBuf = Buffer.from(
      fileBuf.toString('utf8').replace(/^\uFEFF?\s+/, ''),
      'utf8'
    )
  }

  return {
    s3Key: object.key,
    name: object.key.split('/').pop()!,
    format, // html | md | txt | pdf
    bytes: fileBuf.toString('base64')
  }
}
