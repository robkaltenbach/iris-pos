// Embedding generation utilities
import * as FileSystem from 'expo-file-system/legacy';

// Normalize API URL - remove trailing slash to avoid double slashes
const rawApiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const API_URL = rawApiUrl.replace(/\/+$/, ''); // Remove trailing slashes

// Helper to get headers
function getHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
  };
}

/**
 * Generate embedding for an image
 * Options:
 * 1. CLIP via Roboflow (recommended for image search)
 * 2. Voyage AI (multimodal embeddings)
 * 3. OpenAI text embedding (from description)
 * 
 * @param imageUri - Local file URI (file://...) or base64 image
 * @param description - Optional text description for fallback
 * @returns Embedding vector (512 dimensions for CLIP)
 */
export async function generateImageEmbedding(
  imageUri: string,
  description?: string
): Promise<number[]> {
  try {
    console.log('Generating embedding for image:', imageUri.substring(0, 50) + '...');
    
    // Convert file URI to base64 if needed
    let imageBase64: string;
    if (imageUri.startsWith('file://')) {
      // Read file as base64 using expo-file-system
      try {
        // Use string literal 'base64' instead of EncodingType enum
        imageBase64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: 'base64' as any,
        });
        console.log('Image converted to base64, size:', imageBase64.length, 'chars');
      } catch (readError) {
        console.error('Error reading image file:', readError);
        throw new Error(`Failed to read image file: ${readError instanceof Error ? readError.message : 'Unknown error'}`);
      }
    } else if (imageUri.startsWith('data:image')) {
      // Already base64, extract the data part
      imageBase64 = imageUri.replace(/^data:image\/\w+;base64,/, '');
    } else {
      // Assume it's already base64 or a URL
      imageBase64 = imageUri;
    }

    // Call your backend API which handles embedding generation
    const response = await fetch(`${API_URL}/ai/generate-embedding`, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include', // Include cookies/credentials for authentication
      body: JSON.stringify({
        image_base64: imageBase64, // Send as base64
        description: description,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error response:', errorText);
      throw new Error(`Failed to generate embedding: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to generate embedding');
    }
    
    if (!data.embedding || !Array.isArray(data.embedding)) {
      throw new Error('Invalid embedding response from backend');
    }

    console.log('Embedding generated successfully, dimensions:', data.embedding.length);
    return data.embedding as number[];
  } catch (error) {
    console.error('Error generating embedding:', error);
    
    // Fallback: Return zero vector if embedding fails
    // This allows the item to be saved without embedding
    // You can regenerate embeddings later
    console.warn('Using zero vector as fallback embedding');
    return new Array(512).fill(0);
  }
}

/**
 * Generate text embedding from description
 * Useful as a fallback or for text-based search
 */
export async function generateTextEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch(`${API_URL}/ai/generate-text-embedding`, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include', // Include cookies/credentials for authentication
      body: JSON.stringify({
        text: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate text embedding: ${response.statusText}`);
    }

    const data = await response.json();
    return data.embedding as number[];
  } catch (error) {
    console.error('Error generating text embedding:', error);
    return new Array(512).fill(0);
  }
}

