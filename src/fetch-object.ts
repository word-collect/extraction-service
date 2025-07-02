import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { Readable } from 'node:stream'
import crypto from 'node:crypto'

const s3 = new S3Client({})

/* ------------------------------------------------------------------ */
/* tiny helper: keep everything as raw bytes                          */
const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
  const chunks: Uint8Array[] = []
  for await (const chunk of stream)
    chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks)
}
/* ------------------------------------------------------------------ */

export const handler = async (event: {
  detail: { bucket: { name: string }; object: { key: string } }
}) => {
  const { bucket, object } = event.detail

  const resp = await s3.send(
    new GetObjectCommand({ Bucket: bucket.name, Key: object.key })
  )

  /* --- Buffer all the way down ------------------------------------- */
  const fileBuf = await streamToBuffer(resp.Body as Readable)

  /* --- derive “format” exactly as Bedrock wants -------------------- */
  const ct = (resp.ContentType ?? '').toLowerCase()

  const format = ct.includes('html')
    ? 'HTML'
    : ct.includes('markdown')
    ? 'MARKDOWN'
    : ct.includes('pdf')
    ? 'PDF'
    : 'TEXT' /* fall-back */

  /* --- log a hash so you can compare with the console dump --------- */
  console.log(
    'sha256',
    crypto.createHash('sha256').update(fileBuf).digest('hex') /* ★ changed */
  )

  return {
    s3Key: object.key,
    name: object.key.split('/').pop()!,
    format, // HTML | MARKDOWN | TEXT | PDF  (all caps)
    bytes: fileBuf.toString('base64') // still base-64, but from untouched Buffer
  }
}
