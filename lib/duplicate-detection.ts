/**
 * Duplicate detection utilities
 * Helps identify when a scanned item matches an existing item
 */

import { cosineSimilarity } from "./variant-suggestions";

/**
 * Normalize a product name for comparison
 * Removes common suffixes, normalizes whitespace, converts to lowercase
 */
export function normalizeProductName(name: string): string {
  if (!name) return "";
  
  let normalized = name
    .toLowerCase()
    .trim()
    // Normalize common product type variations
    .replace(/\b(nicotine\s+)?pouches?\b/gi, "pouch") // "Nicotine Pouches" -> "pouch", "Pouches" -> "pouch"
    .replace(/\bnicotine\s+pouch\b/gi, "pouch") // "Nicotine Pouch" -> "pouch"
    // Remove common suffixes that AI might add
    .replace(/\s+(with\s+wheels?|figure|toy|pack|set|bundle|multi-pack|variety\s+pack)/gi, "")
    .replace(/\s+(of\s+\d+|x\d+|\d+\s*pack)/gi, "") // Remove "pack of 12", "x12", "12 pack"
    // Normalize numbers (e.g., "3mg" -> "3", "3 mg" -> "3")
    .replace(/\b(\d+)\s*mg\b/gi, "$1") // "3mg" or "3 mg" -> "3"
    .replace(/\b(\d+)\s*count\b/gi, "$1") // "15 count" -> "15"
    .replace(/[^\w\s]/g, " ") // Replace punctuation with spaces
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
  
  return normalized;
}

/**
 * Calculate simple string similarity (Jaro-Winkler-like)
 * Returns a value between 0 and 1
 */
export function stringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;
  
  const s1 = normalizeProductName(str1);
  const s2 = normalizeProductName(str2);
  
  if (s1 === s2) return 1;
  
  // Check if one contains the other (after normalization)
  if (s1.includes(s2) || s2.includes(s1)) {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    return shorter.length / longer.length;
  }
  
  // Simple word-based similarity
  const words1 = new Set(s1.split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(s2.split(/\s+/).filter(w => w.length > 2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Check if two product names are likely the same item
 * Uses normalized name comparison and fuzzy matching
 */
export function isLikelySameProduct(
  name1: string,
  name2: string,
  threshold: number = 0.7 // 70% similarity threshold
): boolean {
  if (!name1 || !name2) return false;
  
  // Exact match after normalization
  if (normalizeProductName(name1) === normalizeProductName(name2)) {
    return true;
  }
  
  // Fuzzy match
  const similarity = stringSimilarity(name1, name2);
  return similarity >= threshold;
}

/**
 * Find duplicate items using multiple strategies:
 * 1. Normalized name matching
 * 2. Fuzzy string similarity
 * 3. Embedding similarity (if embeddings available)
 */
export function findDuplicateItem(
  newItem: {
    name: string;
    embedding?: number[] | null;
  },
  existingItems: Array<{
    id: string;
    name: string;
    ai_detected_name?: string | null; // Original AI name for matching
    keywords?: string[] | null; // Searchable keywords for matching
    embedding?: number[] | null;
    purchase_order_id?: string | null;
  }>,
  targetPOId: string | null,
  options: {
    nameSimilarityThreshold?: number; // Default 0.7
    embeddingSimilarityThreshold?: number; // Default 0.9
    requireEmbeddingMatch?: boolean; // If true, only match if embedding similarity is high
  } = {}
): { id: string; name: string; matchType: "exact" | "fuzzy" | "embedding" } | null {
  const {
    nameSimilarityThreshold = 0.7,
    embeddingSimilarityThreshold = 0.9,
    requireEmbeddingMatch = false,
  } = options;
  
  // Filter items by PO context
  const candidateItems = existingItems.filter(item => {
    if (targetPOId) {
      return item.purchase_order_id === targetPOId;
    } else {
      return item.purchase_order_id === null;
    }
  });
  
  // Strategy 1: Exact normalized name match (check both display name and AI-detected name)
  const normalizedNewName = normalizeProductName(newItem.name);
  for (const item of candidateItems) {
    // Check display name
    if (normalizeProductName(item.name) === normalizedNewName) {
      return { id: item.id, name: item.name, matchType: "exact" };
    }
    // Check AI-detected name if it exists
    if (item.ai_detected_name && normalizeProductName(item.ai_detected_name) === normalizedNewName) {
      return { id: item.id, name: item.name, matchType: "exact" };
    }
  }
  
  // Strategy 2: Fuzzy name matching (check both display name and AI-detected name)
  for (const item of candidateItems) {
    // Check display name
    if (isLikelySameProduct(newItem.name, item.name, nameSimilarityThreshold)) {
      return { id: item.id, name: item.name, matchType: "fuzzy" };
    }
    // Check AI-detected name if it exists
    if (item.ai_detected_name && isLikelySameProduct(newItem.name, item.ai_detected_name, nameSimilarityThreshold)) {
      return { id: item.id, name: item.name, matchType: "fuzzy" };
    }
  }
  
  // Strategy 2.5: Keyword matching (check if new item's name contains keywords from existing items)
  // normalizedNewName is already defined above
  const newNameWords = new Set(normalizedNewName.split(/\s+/).filter(w => w.length > 2));
  
  for (const item of candidateItems) {
    if (item.keywords && Array.isArray(item.keywords) && item.keywords.length > 0) {
      // Check if any keywords from the existing item appear in the new item's name
      const itemKeywords = item.keywords.map(k => normalizeProductName(k));
      const matchingKeywords = itemKeywords.filter(kw => {
        const kwWords = kw.split(/\s+/).filter(w => w.length > 2);
        // Check if any keyword word appears in the new name
        return kwWords.some(kwWord => newNameWords.has(kwWord) || normalizedNewName.includes(kwWord));
      });
      
      // If at least 2 keywords match, or 1 keyword matches and it's a significant word (length > 4)
      if (matchingKeywords.length >= 2 || 
          (matchingKeywords.length >= 1 && matchingKeywords.some(kw => kw.length > 4))) {
        return { id: item.id, name: item.name, matchType: "fuzzy" };
      }
    }
    
    // Also check if new item's words appear in existing item's name or keywords
    const itemNameWords = new Set(normalizeProductName(item.name).split(/\s+/).filter(w => w.length > 2));
    const commonWords = [...newNameWords].filter(w => itemNameWords.has(w));
    if (commonWords.length >= 2 || (commonWords.length >= 1 && commonWords.some(w => w.length > 4))) {
      return { id: item.id, name: item.name, matchType: "fuzzy" };
    }
  }
  
  // Strategy 3: Embedding similarity (if embeddings available)
  if (newItem.embedding && newItem.embedding.length > 0) {
    let bestMatch: { id: string; name: string; similarity: number } | null = null;
    
    for (const item of candidateItems) {
      if (!item.embedding || item.embedding.length === 0) continue;
      
      const similarity = cosineSimilarity(newItem.embedding, item.embedding);
      if (similarity >= embeddingSimilarityThreshold) {
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = { id: item.id, name: item.name, similarity };
        }
      }
    }
    
    if (bestMatch) {
      return { id: bestMatch.id, name: bestMatch.name, matchType: "embedding" };
    }
  }
  
  // If requireEmbeddingMatch is true and we didn't find an embedding match, return null
  if (requireEmbeddingMatch && (!newItem.embedding || newItem.embedding.length === 0)) {
    return null;
  }
  
  return null;
}

