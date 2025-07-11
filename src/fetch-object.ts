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
  const fileBuf = Buffer.concat(chunks)

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

  let format = fmtFromCT || 'txt'

  // if (format === 'html') {
  //   format = 'txt'
  // }

  const [, sub] = object.key.split('/') // raw/<sub>/<uuid>
  return {
    s3Key: object.key,
    name: object.key.split('/').pop()!,
    format, // html | md | txt | pdf
    bytes: fileBuf.toString('base64'),
    userSub: sub
  }
}
