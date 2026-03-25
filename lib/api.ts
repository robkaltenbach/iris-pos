// API service for AI-assisted receiving
import { AIProductData } from './types';

// Normalize API URL - remove trailing slash to avoid double slashes
const rawApiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const API_URL = rawApiUrl.replace(/\/+$/, ''); // Remove trailing slashes

// Helper to get headers
function getHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
  };
}

export interface ReceiveItemResponse {
  success: boolean;
  data?: AIProductData;
  error?: string;
}

export interface DetectedItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  label?: string;
}

export interface DetectItemsResponse {
  success: boolean;
  items?: DetectedItem[];
  message?: string;
  error?: string;
}

/**
 * Send product image to backend for AI analysis
 * Backend calls OpenAI vision model to extract product information
 */
export async function receiveItem(
  imageBase64: string,
  purchaseOrderId: string,
  existingCategories?: string[]
): Promise<ReceiveItemResponse> {
  try {
    console.log('API_URL:', API_URL);
    console.log('Full URL:', `${API_URL}/ai/receive-item`);
    console.log('Image size:', imageBase64?.length || 0, 'chars');
    console.log('Existing categories:', existingCategories?.length || 0);
    
    const headers = getHeaders();
    console.log('Request headers:', { ...headers, 'X-API-Key': headers['X-API-Key'] ? '***' : undefined });
    
    const response = await fetch(`${API_URL}/ai/receive-item`, {
      method: 'POST',
      headers,
      credentials: 'include', // Include cookies/credentials for authentication
      body: JSON.stringify({
        image_base64: imageBase64,
        purchase_order_id: purchaseOrderId,
        existing_categories: existingCategories || [],
      }),
    });

    console.log('Response status:', response.status, response.statusText);

    // Always try to parse JSON first (even if response is not ok)
    // This allows us to handle skipped items gracefully
    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      // If we can't parse JSON, it's a real error
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      throw new Error('Invalid response format');
    }
    
    // Handle skipped items FIRST (OpenAI couldn't extract info - not an error)
    // Even if response.ok is false, if it's a skipped item, we should return success: false, not throw
    if (!data.success && data.skipped) {
      return {
        success: false,
        data: { skipped: true } as any, // Include skipped flag in data
        error: data.error || 'Unable to extract product information',
      };
    }
    
    // Check for parsing-related errors in the error message - treat as skipped
    if (!data.success && data.error) {
      const errorMsg = data.error.toLowerCase();
      if (errorMsg.includes('parse') || errorMsg.includes('ai response') || errorMsg.includes('extract') || errorMsg.includes('missing required field')) {
        return {
          success: false,
          data: { skipped: true } as any,
          error: data.error,
        };
      }
    }
    
    // If response is not ok AND not a skipped item, then it's an actual error
    if (!response.ok) {
      const errorMsg = data.error || `HTTP error! status: ${response.status}`;
      throw new Error(errorMsg);
    }
    
    // Backend returns product data directly if success is true
    if (data.success && data.name) {
      return {
        success: true,
        data: data as AIProductData,
      };
    }
    
    // Handle error response (but not if already handled above)
    if (!data.success) {
      // Treat as skipped if error message suggests parsing issues
      const errorMsg = data.error || 'Failed to process image';
      if (errorMsg.includes('parse') || errorMsg.includes('AI response') || errorMsg.includes('extract')) {
        return {
          success: false,
          data: { skipped: true } as any,
          error: errorMsg,
        };
      }
      throw new Error(errorMsg);
    }
    
    // Fallback: assume the response is the product data
    return {
      success: true,
      data: data as AIProductData,
    };
  } catch (error) {
    console.error('Error receiving item:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process image',
    };
  }
}

/**
 * Detect multiple items in an image using object detection
 * POST /ai/detect-items
 */
export async function detectItems(
  imageBase64: string,
  purchaseOrderId: string,
  existingCategories?: string[]
): Promise<DetectItemsResponse> {
  try {
    const startTime = Date.now();
    console.log('Detecting multiple items in image...');
    console.log('API_URL:', API_URL);
    console.log('Full URL:', `${API_URL}/ai/detect-items`);
    console.log('Image size:', imageBase64?.length || 0, 'chars');
    
    const requestBody = {
      image_base64: imageBase64,
      purchase_order_id: purchaseOrderId,
      existing_categories: existingCategories || [],
    };
    
    const headers = getHeaders();
    console.log('Request headers:', { ...headers, 'X-API-Key': headers['X-API-Key'] ? '***' : undefined });
    const requestBodyString = JSON.stringify(requestBody);
    const requestBodySizeKB = (requestBodyString.length * 3) / 4 / 1024; // Approximate KB
    const requestBodySizeMB = requestBodySizeKB / 1024;
    console.log('Request body size:', requestBodyString.length, 'chars (~' + requestBodySizeKB.toFixed(1) + ' KB / ~' + requestBodySizeMB.toFixed(2) + ' MB)');
    
    // Vercel free tier has a 4.5MB request body limit
    if (requestBodySizeMB > 4.5) {
      console.error('❌ ERROR: Request body exceeds Vercel free tier limit (4.5MB)!');
      console.error('This will cause the request to fail on Vercel. Please compress the image.');
      throw new Error(`Request body too large (${requestBodySizeMB.toFixed(2)}MB). Vercel free tier limit is 4.5MB. Please compress the image or use a smaller image quality setting.`);
    }
    
    if (requestBodySizeKB > 5000) { // Warn if > 5MB
      console.warn('⚠️ Large request body detected! This may cause timeouts. Consider compressing the image.');
    }
    
    console.log('Sending fetch request at', new Date().toISOString());
    
    // Use AbortController for better timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      const elapsed = Date.now() - startTime;
      console.error(`❌ Fetch request timeout after ${elapsed}ms - aborting...`);
      console.error('This indicates the server is not responding or the request is too large.');
      controller.abort();
    }, 30000); // 30 second timeout
    
    let response;
    try {
      const fetchPromise = fetch(`${API_URL}/ai/detect-items`, {
        method: 'POST',
        headers,
        credentials: 'include', // Include cookies/credentials for authentication
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      
      // Log progress every 5 seconds while waiting
      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        console.log(`⏳ Still waiting for response... (${elapsed}ms elapsed)`);
      }, 5000);
      
      try {
        response = await fetchPromise;
      } finally {
        clearInterval(progressInterval);
        clearTimeout(timeoutId);
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      const elapsed = Date.now() - startTime;
      console.error(`❌ Fetch error after ${elapsed}ms:`, fetchError);
      if (fetchError.name === 'AbortError') {
        throw new Error(`Request timed out after 30 seconds (${elapsed}ms elapsed). The backend at ${API_URL} may be unreachable or processing is taking too long.`);
      }
      if (fetchError.message?.includes('network') || fetchError.message?.includes('fetch')) {
        throw new Error(`Network error: Unable to reach ${API_URL}. Check your connection and ensure the backend is running.`);
      }
      throw fetchError;
    }

    const elapsedTime = Date.now() - startTime;
    console.log(`Response received after ${elapsedTime}ms`);
    console.log('Response status:', response.status, response.statusText);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
        console.error('Error response body:', errorText);
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.error || `HTTP error! status: ${response.status} ${response.statusText}`);
      } catch (parseError) {
        // If we can't parse JSON, use the text directly
        throw new Error(`HTTP error! status: ${response.status} ${response.statusText}. Response: ${errorText || 'No error message'}`);
      }
    }

    const responseText = await response.text();
    console.log('Response body length:', responseText.length);
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse JSON response:', responseText.substring(0, 200));
      throw new Error(`Invalid JSON response from server: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
    }
    
    console.log('Parsed response:', { success: data.success, itemsCount: data.items?.length || 0 });
    
    if (data.success && data.items) {
      console.log(`Successfully detected ${data.items.length} item(s)`);
      return {
        success: true,
        items: data.items,
        message: data.message,
      };
    }
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to detect items');
    }
    
    return {
      success: false,
      error: 'Invalid response format',
    };
  } catch (error) {
    console.error('Error detecting items:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to detect items';
    
    // Check if it's a network error (no response received)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('Network error - request may not have reached server. Check:');
      console.error('1. API_URL is correct:', API_URL);
      console.error('2. Network connectivity');
      console.error('3. CORS configuration on server');
      console.error('4. API key configuration (if required)');
      return {
        success: false,
        error: `Network error: Unable to reach backend at ${API_URL}. Please check your connection and API URL configuration.`,
      };
    }
    
    console.error('Full error details:', {
      message: errorMessage,
      name: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return {
      success: false,
      error: errorMessage,
    };
  }
}

