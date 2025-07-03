import {
  BedrockRuntimeClient,
  ConverseCommand
} from '@aws-sdk/client-bedrock-runtime'
import { SYSTEM_PROMPT, USER_PROMPT } from './prompts'

const client = new BedrockRuntimeClient({})

/**
 * Expected event shape (from FetchObjectFn):
 * {
 *   format: 'html' | 'txt' | 'md' | 'pdf',
 *   name:   'sample.html',
 *   bytes:  '<base-64 string>',
 *   s3Key:  'raw/…'
 * }
 */
export const handler = async (event: any) => {
  const { format, name, bytes } = event

  const resp = await client.send(
    new ConverseCommand({
      modelId: process.env.MODEL_ID!, // short ID
      system: [{ text: SYSTEM_PROMPT }],
      messages: [
        {
          role: 'user',
          content: [
            { text: USER_PROMPT },
            {
              document: {
                format,
                name,
                source: { bytes: Buffer.from(bytes, 'base64') }
              }
            }
          ]
        }
      ],
      inferenceConfig: { maxTokens: 4096, temperature: 0, topP: 1 },
      additionalModelRequestFields: { top_k: 1 }
    })
  )

  // return the Bedrock text so SFN can pick it up at $.analysis
  return {
    analysis: resp.output?.message?.content?.[0]?.text ?? ''
  }
}
