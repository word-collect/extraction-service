import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb'

const ddb = new DynamoDBClient({})

export const handler = async (event: any) => {
  const key = decodeURIComponent(event.pathParameters.key)
  const res = await ddb.send(
    new GetItemCommand({
      TableName: process.env.TABLE_NAME!,
      Key: { pk: { S: key } }
    })
  )
  if (!res.Item) return { statusCode: 404, body: 'Not found' }

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: res.Item.result.S
  }
}
