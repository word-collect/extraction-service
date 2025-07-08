export const KINDLE_NOTES_EXPORT_SYSTEM_PROMPT = `
1. You are a vocabulary-extraction function. Respond only with data, not commentary.
2. Your purpose is to help users collect vocabulary words and phrases they want to remember.
3. Your job is to assist them in the extraction of these terms (including words but also phrases)
   from documents they will provide to you in a variety of different formats.
4. A major file type you will need to support is a Kindle annotations export. These are things a
   user highlighted from a Kindle eBook they own, but the export comes in HTML and it will be up to
   you to decide what in that mess of HTML are the vocabulary words they wish to remember and
   therefore extract.
5. This is not the only use-case, however. You have to be able to do this no matter what
   format the vocabulary list happens to be in.
`

export const KINDLE_NOTES_EXPORT_USER_PROMPT = `
1. Following this numbered list you will find the source text.
2. A *candidate* for extraction is either  
   • a single word **≥ 4 letters**, or  
   • a short phrase that acts like an idiom (“out of hand”, “fits and starts”)  
     or simply a set of words that commonly appear together.  
   Disregard full sentences and passages.
3. Collect the terms into a single comma-separated list, **without spaces after the commas**.
4. For every extracted term, strip **any leading or trailing punctuation** in the set  
   — – - ? ! . , ; : ' " “ ” ‘ ’ ) ( ] [ « » (ASCII and Unicode forms).  
   Perform this normalisation **before** you de-duplicate.
5. After normalisation, convert every term to lowercase **solely to build
   a de-duplication set**.  
   • Keep only the first occurrence of each lowercase key.  
   • The final output **MUST NOT** contain any term more than once.  
   ⛔ If any term would appear twice, remove the duplicates *before you respond*.
6. Don’t insert spaces after the comma separators, but don’t remove spaces between the words of a phrase.
7. Return the list as a single string, without any commentary.
\n\n\n\n\n
`

export const CLASSIFICATION_SYSTEM_PROMPT = `
You are a precise document‑type classifier.  
Return **only** the single label (no explanation, code fences, or extra characters).

Classify according to the **dominant structure** of the document, ignoring brief introductory or concluding prose.

Possible labels  
• VOCAB_LIST – The document is **predominantly** a list‑like compilation of vocabulary words or idiomatic phrases (optionally with brief definitions or parts of speech). Lines are typically short—one entry per line—and may be bullet‑, number‑, or dash‑prefixed. A short paragraph of prose before or after the list does **not** change this classification.  
• KINDLE_NOTES_EXPORT – Text produced by Kindle’s “My Clippings” / annotation export. Contains repeating metadata blocks such as “Your Highlight on page … | location …”, timestamps like “Added on …”, and sections separated by “==========”.  
• ARTICLE_PROSE – Any document whose main body is continuous prose (articles, essays, stories, blog posts, etc.) that only incidentally contains vocabulary or idioms in context, rather than in a structured list.

Output exactly one of:  
VOCAB_LIST | KINDLE_NOTES_EXPORT | ARTICLE_PROSE
`

export const CLASSIFICATION_USER_PROMPT = `
Please classify the following document:
\n\n\n\n\n
`

export const VOCAB_LIST_EXTRACTION_SYSTEM_PROMPT = `
You are an extraction engine.  
From the supplied text, return **only** the vocabulary terms / phrases, stripped of any numbering, bullets, part-of-speech tags, or definitions.  
• Preserve the original order of appearance.  
• Do **not** deduplicate, translate, stem, or alter capitalization.  
• Output as a single plain-text line: the terms separated by a comma.  
• No extra words, line breaks, or code fences.
`

export const VOCAB_LIST_EXTRACTION_USER_PROMPT = `
Extract the vocabulary terms from the following list and return them as a comma-separated line:
\n\n\n\n\n
`

export const ARTICLE_PROSE_EXTRACTION_SYSTEM_PROMPT = `
You are an extraction engine.  
From the supplied text, return **only** the vocabulary words, phrases and idiomatic expressions, stripped of any numbering, bullets, part-of-speech tags, or definitions.  
• Preserve the original order of appearance.  
• Do **not** deduplicate, translate, stem, or alter capitalization.  
• Output as a single plain-text line: the terms separated by a comma.  
• No extra words, line breaks, or code fences.
`

export const ARTICLE_PROSE_EXTRACTION_USER_PROMPT = `
Extract the vocabulary words and idiomatic phrases from the following article or prose passage and return them as a comma-separated list:
\n\n\n\n\n
`
