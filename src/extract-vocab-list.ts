import {
  BedrockRuntimeClient,
  ConverseCommand
} from '@aws-sdk/client-bedrock-runtime'
import {
  VOCAB_LIST_EXTRACTION_SYSTEM_PROMPT,
  VOCAB_LIST_EXTRACTION_USER_PROMPT
} from './prompts'

const brClient = new BedrockRuntimeClient({})

export const handler = async (event: any) => {
  const { format, name, bytes } = event

  const resp = await brClient.send(
    new ConverseCommand({
      modelId: process.env.MODEL_ID!,
      system: [{ text: VOCAB_LIST_EXTRACTION_SYSTEM_PROMPT }],
      messages: [
        {
          role: 'user',
          content: [
            { text: VOCAB_LIST_EXTRACTION_USER_PROMPT },
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

  return resp.output?.message?.content?.[0]?.text?.trim() ?? ''
}
