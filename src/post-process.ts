// src/post-processing.ts
/**
 * Input event shape (from SFN):
 * {
 *   s3Key:    'raw/…',
 *   analysis: 'word1,word2,word1,word3,…',
 *   …anything else you pass through…
 * }
 *
 * Output: the cleaned-up string only
 */
export const handler = async (event: { analysis: string }) => {
  // ① split, ② dedupe via Set, ③ join
  const deduped = Array.from(new Set(event.analysis.split(','))).join(',')
  return deduped
}
