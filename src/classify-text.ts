import {
  BedrockRuntimeClient,
  ConverseCommand
} from '@aws-sdk/client-bedrock-runtime'
import {
  CLASSIFICATION_SYSTEM_PROMPT,
  CLASSIFICATION_USER_PROMPT
} from './prompts'

const brClient = new BedrockRuntimeClient({})

export const handler = async (event: any) => {
  const { format, name, bytes } = event

  const resp = await brClient.send(
    new ConverseCommand({
      modelId: process.env.MODEL_ID!, // short model ID
      system: [{ text: CLASSIFICATION_SYSTEM_PROMPT }],
      messages: [
        {
          role: 'user',
          content: [
            { text: CLASSIFICATION_USER_PROMPT },
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
      inferenceConfig: { maxTokens: 10, temperature: 0, topP: 1 },
      additionalModelRequestFields: { top_k: 1 }
    })
  )

  // e.g.  "KINDLE_NOTES_EXPORT" | "VOCAB_LIST" | "ARTICLE_PROSE"
  return resp.output?.message?.content?.[0]?.text?.trim() ?? ''
}
