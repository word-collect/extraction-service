import {
  BedrockRuntimeClient,
  ConverseCommand
} from '@aws-sdk/client-bedrock-runtime'
import {
  KINDLE_NOTES_EXPORT_SYSTEM_PROMPT,
  KINDLE_NOTES_EXPORT_USER_PROMPT
} from './prompts'

const client = new BedrockRuntimeClient({})

export const handler = async (event: any) => {
  const { format, name, bytes } = event

  const resp = await client.send(
    new ConverseCommand({
      modelId: process.env.MODEL_ID!, // short ID
      system: [{ text: KINDLE_NOTES_EXPORT_SYSTEM_PROMPT }],
      messages: [
        {
          role: 'user',
          content: [
            { text: KINDLE_NOTES_EXPORT_USER_PROMPT },
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

  return resp.output?.message?.content?.[0]?.text ?? ''
}
