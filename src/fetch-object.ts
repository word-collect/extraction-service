import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { TextDecoder } from 'util'

const s3 = new S3Client({})
export const handler = async (event: any) => {
  const { bucket, object } = event.detail
  const res = await s3.send(
    new GetObjectCommand({
      Bucket: bucket.name,
      Key: object.key
    })
  )
  const text = await res.Body!.transformToString()
  return { text, s3Key: object.key }
}
