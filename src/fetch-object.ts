import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { Readable } from 'node:stream'
import { extname } from 'node:path'

const s3 = new S3Client({})

export const handler = async (event: {
  detail: { bucket: { name: string }; object: { key: string } }
}) => {
  const { bucket, object } = event.detail

  // ••• fetch object from S3 •••
  const resp = await s3.send(
    new GetObjectCommand({ Bucket: bucket.name, Key: object.key })
  )

  const chunks: Buffer[] = []
  for await (const chunk of resp.Body as Readable) chunks.push(chunk as Buffer)
  const fileBuf = Buffer.concat(chunks)

  // derive a simple format hint from extension
  const ext = extname(object.key).toLowerCase().replace('.', '') || 'txt'
  const format = ext === 'html' ? 'html' : ext === 'md' ? 'md' : 'txt'

  return {
    s3Key: object.key,
    name: object.key.split('/').pop()!,
    format, // html | md | txt | pdf | …
    bytes: fileBuf.toString('base64')
  }
}
