import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { Readable } from 'node:stream'

// event = { s3Key: 'raw/xxxx', bucket: '…' } – sent by the rule
export const handler = async (event: { s3Key: string; bucket: string }) => {
  const s3 = new S3Client({})
  const resp = await s3.send(
    new GetObjectCommand({ Bucket: event.bucket, Key: event.s3Key })
  )

  // stream → buffer → UTF-8 string
  const chunks: Buffer[] = []
  for await (const chunk of resp.Body as Readable) chunks.push(chunk as Buffer)
  const text = Buffer.concat(chunks).toString('utf-8')

  return {
    // 👈  shape the SFN state will receive
    s3Key: event.s3Key,
    text
  }
}
