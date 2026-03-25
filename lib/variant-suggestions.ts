/**
 * Variant suggestion utilities
 * Checks for similar items that might be variants of the same product
 */

/**
 * Calculate cosine similarity between two embedding vectors
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    return 0;
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

/**
 * Find similar items that might be variants
 * Returns items with similarity score above threshold
 */
export function findSimilarItems(
  embedding: number[] | null,
  allItems: Array<{ id: string; name: string; embedding: number[] | null }>,
  threshold: number = 0.85 // 85% similarity threshold
): Array<{ id: string; name: string; similarity: number }> {
  if (!embedding || embedding.length === 0) {
    return [];
  }

  const similar: Array<{ id: string; name: string; similarity: number }> = [];

  for (const item of allItems) {
    if (!item.embedding || item.embedding.length === 0) {
      continue;
    }

    const similarity = cosineSimilarity(embedding, item.embedding);
    if (similarity >= threshold) {
      similar.push({
        id: item.id,
        name: item.name,
        similarity,
      });
    }
  }

  // Sort by similarity (highest first)
  similar.sort((a, b) => b.similarity - a.similarity);

  return similar;
}

/**
 * Check if items should be suggested as variants
 * Returns true if similarity is high enough and names are similar
 */
export function shouldSuggestAsVariants(
  item1Name: string,
  item2Name: string,
  similarity: number,
  similarityThreshold: number = 0.85,
  nameSimilarityThreshold: number = 0.6 // 60% name similarity
): boolean {
  // Check embedding similarity
  if (similarity < similarityThreshold) {
    return false;
  }

  // Simple name similarity check (can be improved with fuzzy matching)
  const name1 = item1Name.toLowerCase().trim();
  const name2 = item2Name.toLowerCase().trim();
  
  // Check if names share significant words
  const words1 = name1.split(/\s+/);
  const words2 = name2.split(/\s+/);
  
  const commonWords = words1.filter(w => words2.includes(w));
  const nameSimilarity = commonWords.length / Math.max(words1.length, words2.length);
  
  return nameSimilarity >= nameSimilarityThreshold;
}

