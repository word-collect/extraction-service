import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3'

const s3 = new S3Client({})

export const handler = async (event: {
  detail: { bucket: { name: string }; object: { key: string } }
}) => {
  const { bucket, object } = event.detail

  // we only need metadata now
  const head = await s3.send(
    new HeadObjectCommand({ Bucket: bucket.name, Key: object.key })
  )

  const ct = head.ContentType ?? ''
  const format = ct.includes('html')
    ? 'html'
    : ct.includes('markdown')
    ? 'md'
    : ct.includes('pdf')
    ? 'pdf'
    : 'txt'

  return {
    s3Uri: `s3://${bucket.name}/${object.key}`, // NEW
    name: object.key.split('/').pop()!,
    format // html | md | pdf | txt
  }
}
