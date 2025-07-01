import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { Readable } from 'node:stream'

export const handler = async (event: {
  detail: { bucket: { name: string }; object: { key: string } }
}) => {
  const s3 = new S3Client({})
  const { bucket, object } = event.detail

  const resp = await s3.send(
    new GetObjectCommand({ Bucket: bucket.name, Key: object.key })
  )

  // stream → buffer → UTF-8 string
  const chunks: Buffer[] = []
  for await (const chunk of resp.Body as Readable) chunks.push(chunk as Buffer)
  const text = Buffer.concat(chunks).toString('utf-8')

  return {
    // 👈  shape the SFN state will receive
    s3Key: object.key,
    text
  }
}
