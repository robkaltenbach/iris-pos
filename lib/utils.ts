/**
 * Utility functions for retry logic, timeouts, and error handling
 */

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Failed after retries');
}

/**
 * Add timeout to a promise
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

/**
 * Compress base64 image by reducing quality
 * Returns a smaller base64 string
 */
export function compressBase64Image(
  base64: string,
  maxSizeKB: number = 500
): string {
  // Remove data URL prefix if present
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
  
  // Calculate current size in KB
  const sizeKB = (base64Data.length * 3) / 4 / 1024;
  
  // If already small enough, return as-is
  if (sizeKB <= maxSizeKB) {
    return base64;
  }
  
  // For now, just return the original
  // In a real implementation, you'd decode, resize, and re-encode
  // This is a placeholder - actual compression should be done at capture time
  console.warn(`Image size (${sizeKB.toFixed(1)}KB) exceeds target (${maxSizeKB}KB), but compression not implemented yet`);
  return base64;
}

/**
 * Format error message for user display
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Check for common error types
    if (error.message.includes('Network request failed') || error.message.includes('fetch')) {
      return 'Network error. Please check your connection and try again.';
    }
    if (error.message.includes('timeout') || error.message.includes('timed out')) {
      return 'Request timed out. The server may be slow. Please try again.';
    }
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      return 'Authentication error. Please check your API keys.';
    }
    if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
      return 'Server error. Please try again in a moment.';
    }
    return error.message;
  }
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('500') ||
      message.includes('503') ||
      message.includes('502')
    );
  }
  return false;
}

