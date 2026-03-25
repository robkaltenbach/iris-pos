import dotenv from 'dotenv';
import fetch from 'node-fetch';
import FormData from 'form-data';

dotenv.config();

/**
 * Detect multiple items in an image using Roboflow Object Detection
 * POST /ai/detect-items
 * 
 * Returns bounding boxes for each detected item, then processes each item
 * to extract product information and generate embeddings.
 */
export async function detectItems(req, res) {
  const startTime = Date.now();
  console.log('[detect-items] Request received at', new Date().toISOString());
  console.log('[detect-items] Request path:', req.path);
  console.log('[detect-items] Request method:', req.method);
  
  try {
    const { image_base64, purchase_order_id, existing_categories = [] } = req.body;

    if (!image_base64) {
      console.error('[detect-items] Missing image_base64');
      return res.status(400).json({
        success: false,
        error: 'Missing image_base64 in request body',
      });
    }

    console.log('[detect-items] Image size:', image_base64.length, 'chars');

    // Remove data URL prefix if present
    const base64Image = image_base64.replace(/^data:image\/\w+;base64,/, '');

    // Check if Roboflow Object Detection is configured
    const roboflowApiKey = process.env.ROBOFLOW_API_KEY;
    const roboflowProject = process.env.ROBOFLOW_OBJECT_DETECTION_PROJECT;
    const roboflowVersion = process.env.ROBOFLOW_OBJECT_DETECTION_VERSION;
    
    console.log('[detect-items] Roboflow config:', {
      hasApiKey: !!roboflowApiKey,
      hasProject: !!roboflowProject,
      hasVersion: !!roboflowVersion,
    });

    let detectedItems = [];

    // Option 1: Use Roboflow Object Detection if configured
    if (roboflowApiKey && roboflowProject && roboflowVersion) {
      try {
        console.log('Using Roboflow Object Detection for multi-item detection');
        detectedItems = await detectWithRoboflow(
          base64Image,
          roboflowApiKey,
          roboflowProject,
          roboflowVersion
        );
      } catch (roboflowError) {
        console.warn('Roboflow Object Detection failed, using fallback:', roboflowError.message);
        // Fall through to fallback
      }
    }

    // Option 2: Fallback - process whole image as single item
    // This allows multi-scan to work even without Object Detection configured
    if (detectedItems.length === 0) {
      console.log('Using fallback: processing whole image as single item');
      console.log('Roboflow config check:', {
        hasApiKey: !!roboflowApiKey,
        hasProject: !!roboflowProject,
        hasVersion: !!roboflowVersion,
      });
      detectedItems = [{
        id: 'fallback-item-0',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        confidence: 1.0,
        label: 'Item',
      }];
    } else {
      console.log(`Successfully detected ${detectedItems.length} items from Roboflow`);
    }

    // For each detected item, we'll need to:
    // 1. Crop the image region
    // 2. Extract product info (delegated to frontend or separate call)
    // 3. Generate embedding (delegated to frontend or separate call)
    
    // For now, return bounding boxes - frontend will handle processing each item
    const elapsed = Date.now() - startTime;
    console.log(`[detect-items] Successfully processed in ${elapsed}ms, returning ${detectedItems.length} item(s)`);
    
    res.json({
      success: true,
      items: detectedItems,
      message: detectedItems.length === 1 && !roboflowProject 
        ? 'Object Detection not configured. Processing whole image. Configure ROBOFLOW_OBJECT_DETECTION_PROJECT for multi-item detection.'
        : `Detected ${detectedItems.length} item(s)`,
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[detect-items] Error after ${elapsed}ms:`, error);
    console.error('[detect-items] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to detect items',
    });
  }
}

/**
 * Detect items using Roboflow Object Detection API
 */
async function detectWithRoboflow(base64Image, apiKey, project, version) {
  try {
    // Roboflow Object Detection API endpoint
    const url = `https://detect.roboflow.com/${project}/${version}`;
    
    // Create form data
    const formData = new FormData();
    const imageBuffer = Buffer.from(base64Image, 'base64');
    formData.append('file', imageBuffer, {
      filename: 'image.jpg',
      contentType: 'image/jpeg',
    });

    // Roboflow Object Detection API - request JSON format with normalized coordinates
    // The API returns normalized coordinates (0-1) by default
    const apiUrl = `${url}?api_key=${apiKey}&format=json`;
    console.log('Calling Roboflow API:', apiUrl.replace(apiKey, 'REDACTED'));
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: formData.getHeaders ? formData.getHeaders() : {},
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Roboflow API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Log raw Roboflow response for debugging
    console.log('Raw Roboflow response:', JSON.stringify(data, null, 2));
    
    // Roboflow Object Detection API can return different formats:
    // Format 1: { predictions: [{ x, y, width, height, confidence, class }] }
    // Format 2: { predictions: [{ x_center, y_center, width, height, confidence, class }] }
    // Format 3: { predictions: [{ x, y, width, height, confidence, class, points }] }
    // Check if we have predictions array
    if (!data.predictions || !Array.isArray(data.predictions)) {
      console.error('Invalid Roboflow response format:', data);
      throw new Error('Invalid response format from Roboflow');
    }
    
    // Get image dimensions if available (Roboflow might return them)
    const imageWidth = data.image?.width || null;
    const imageHeight = data.image?.height || null;
    console.log('Image dimensions from Roboflow:', { width: imageWidth, height: imageHeight });
    
    // Check the first prediction to understand the format
    if (data.predictions.length > 0) {
      const firstPred = data.predictions[0];
      console.log('First prediction structure:', Object.keys(firstPred));
      console.log('First prediction values:', JSON.stringify(firstPred, null, 2));
      
      // Check if coordinates look like pixels or normalized
      const sampleX = firstPred.x_center || firstPred.x || 0;
      const sampleY = firstPred.y_center || firstPred.y || 0;
      const sampleW = firstPred.width || 0;
      const sampleH = firstPred.height || 0;
      console.log('Sample coordinate values:', { x: sampleX, y: sampleY, w: sampleW, h: sampleH });
      
      if (sampleX > 1 || sampleY > 1 || sampleW > 1 || sampleH > 1) {
        console.log('Coordinates appear to be in pixels, not normalized');
      } else {
        console.log('Coordinates appear to be normalized (0-1)');
      }
    }

    // Convert Roboflow format to our format
    // Roboflow Object Detection API typically returns:
    // - x, y: center coordinates (normalized 0-1) OR top-left (normalized 0-1)
    // - width, height: dimensions (normalized 0-1)
    // But field names might vary: x_center, y_center, x, y, etc.
    const items = data.predictions.map((pred, index) => {
      console.log(`Processing prediction ${index}:`, JSON.stringify(pred, null, 2));
      
      // Try to extract coordinates - handle different field name variations
      // Roboflow typically uses: x, y (center), width, height (all normalized 0-1)
      let centerX, centerY, width, height;
      let isNormalized = true; // Assume normalized by default
      
      // Try multiple field name patterns in order of likelihood
      // Pattern 1: x, y (center coordinates) - most common Roboflow format
      if (pred.x !== undefined && pred.y !== undefined && pred.width !== undefined && pred.height !== undefined) {
        centerX = Number(pred.x);
        centerY = Number(pred.y);
        width = Number(pred.width);
        height = Number(pred.height);
        console.log(`Prediction ${index}: Using x, y, width, height format`);
      }
      // Pattern 2: x_center, y_center (explicit center coordinates)
      else if (pred.x_center !== undefined && pred.y_center !== undefined) {
        centerX = Number(pred.x_center);
        centerY = Number(pred.y_center);
        width = Number(pred.width || 0);
        height = Number(pred.height || 0);
        console.log(`Prediction ${index}: Using x_center, y_center format`);
      }
      // Pattern 3: Try to extract from points array
      else if (pred.points && Array.isArray(pred.points) && pred.points.length >= 4) {
        // Calculate bounding box from points
        const xs = pred.points.map(p => (typeof p === 'object' ? (p.x !== undefined ? p.x : p[0]) : p));
        const ys = pred.points.map(p => (typeof p === 'object' ? (p.y !== undefined ? p.y : p[1]) : p));
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        width = maxX - minX;
        height = maxY - minY;
        centerX = minX + (width / 2);
        centerY = minY + (height / 2);
        console.log(`Prediction ${index}: Calculated from points array`);
      }
      // Pattern 4: Try alternative field names
      else if (pred.x1 !== undefined && pred.y1 !== undefined && pred.x2 !== undefined && pred.y2 !== undefined) {
        // Top-left and bottom-right corners
        const x1 = Number(pred.x1);
        const y1 = Number(pred.y1);
        const x2 = Number(pred.x2);
        const y2 = Number(pred.y2);
        width = Math.abs(x2 - x1);
        height = Math.abs(y2 - y1);
        centerX = (x1 + x2) / 2;
        centerY = (y1 + y2) / 2;
        console.log(`Prediction ${index}: Using x1, y1, x2, y2 format`);
      }
      else {
        console.error(`Prediction ${index} missing coordinate fields. Available fields:`, Object.keys(pred));
        console.error(`Prediction ${index} full data:`, JSON.stringify(pred, null, 2));
        // Skip this prediction
        return null;
      }
      
      // Validate extracted values
      if (isNaN(centerX) || isNaN(centerY) || isNaN(width) || isNaN(height)) {
        console.error(`Prediction ${index} has NaN values:`, { centerX, centerY, width, height });
        return null;
      }
      
      // Log extracted raw values before any conversion
      console.log(`Prediction ${index} raw extracted values:`, {
        centerX,
        centerY,
        width,
        height,
        isNormalized: centerX <= 1 && centerY <= 1 && width <= 1 && height <= 1
      });
      
      // Determine if coordinates are in pixels or normalized
      // If we have image dimensions and coordinates are > 1, they're likely pixels
      // If coordinates are all <= 1, they're likely normalized
      const maxCoord = Math.max(centerX, centerY, width, height);
      if (maxCoord > 1 && imageWidth && imageHeight) {
        isNormalized = false;
        console.log(`Prediction ${index}: Coordinates are in pixels, normalizing...`);
        // Normalize pixel coordinates to 0-1
        centerX = centerX / imageWidth;
        centerY = centerY / imageHeight;
        width = width / imageWidth;
        height = height / imageHeight;
      } else if (maxCoord > 1) {
        // Coordinates > 1 but no image dimensions - assume they're pixels but we can't normalize
        console.warn(`Prediction ${index}: Coordinates > 1 but no image dimensions. Assuming normalized and clamping.`);
        // Clamp to 0-1 range (this might cause issues, but better than nothing)
        centerX = Math.min(1, centerX / 1000); // Rough guess: divide by large number
        centerY = Math.min(1, centerY / 1000);
        width = Math.min(1, width / 1000);
        height = Math.min(1, height / 1000);
      }
      
      // Check if width/height are 0, that's a problem
      if (width === 0 || height === 0) {
        console.warn(`Prediction ${index} has zero width or height. Original values:`, {
          centerX, centerY, width, height,
          predKeys: Object.keys(pred)
        });
        // Try to calculate from points if available
        if (pred.points && Array.isArray(pred.points) && pred.points.length >= 2) {
          // Calculate width/height from points
          const xs = pred.points.map(p => p.x || p[0]);
          const ys = pred.points.map(p => p.y || p[1]);
          width = Math.max(...xs) - Math.min(...xs);
          height = Math.max(...ys) - Math.min(...ys);
          centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
          centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
          console.log(`Calculated from points: x=${centerX}, y=${centerY}, w=${width}, h=${height}`);
        } else {
          // Skip invalid prediction
          console.warn(`Skipping prediction ${index} due to invalid dimensions`);
          return null;
        }
      }
      
      // Ensure values are in valid range (0-1 for normalized)
      // If values are > 1, they might be pixels - we'd need image dimensions to normalize
      // For now, assume normalized and clamp
      centerX = Math.max(0, Math.min(1, centerX));
      centerY = Math.max(0, Math.min(1, centerY));
      width = Math.max(0, Math.min(1, width));
      height = Math.max(0, Math.min(1, height));
      
      // Convert center coordinates to top-left
      let x = centerX - (width / 2);
      let y = centerY - (height / 2);
      
      // Ensure coordinates are in valid range (0-1)
      x = Math.max(0, Math.min(1, x));
      y = Math.max(0, Math.min(1, y));
      
      // Ensure box doesn't go outside bounds
      if (x + width > 1) width = 1 - x;
      if (y + height > 1) height = 1 - y;
      
      // Final check - if width/height are still 0 or very small, skip
      if (width <= 0.01 || height <= 0.01) {
        console.warn(`Prediction ${index} has invalid dimensions after conversion: width=${width}, height=${height}`);
        return null;
      }
      
      // Convert normalized (0-1) to percentages (0-100)
      x = x * 100;
      y = y * 100;
      width = width * 100;
      height = height * 100;
      
      const result = {
        id: `item-${index}`,
        x,
        y,
        width,
        height,
        confidence: pred.confidence || 0.5,
        label: pred.class || pred.class_name || 'Item',
      };
      
      console.log(`Converted prediction ${index} to:`, JSON.stringify(result, null, 2));
      
      // Warn if coordinates look suspicious (all same value or all 50%)
      if (result.x === 50 && result.y === 50 && result.width === 50 && result.height === 50) {
        console.warn(`WARNING: Prediction ${index} has suspicious coordinates (all 50%). This might indicate a conversion error.`);
      }
      
      return result;
    }).filter(item => item !== null); // Remove null entries

    console.log(`Detected ${items.length} items using Roboflow Object Detection`);
    console.log('Detected items details:', JSON.stringify(items, null, 2));
    
    // Check if all items have the same coordinates (indicates a problem)
    if (items.length > 1) {
      const firstItem = items[0];
      const allSame = items.every(item => 
        item.x === firstItem.x && 
        item.y === firstItem.y && 
        item.width === firstItem.width && 
        item.height === firstItem.height
      );
      if (allSame) {
        console.error('WARNING: All detected items have identical coordinates! This indicates a coordinate extraction bug.');
      }
    }
    
    return items;
  } catch (error) {
    console.error('Roboflow Object Detection error:', error);
    throw error;
  }
}

