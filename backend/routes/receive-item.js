import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Extract product information from image using OpenAI Vision
 * POST /ai/receive-item
 */
export async function receiveItem(req, res) {
  try {
    const { image_base64, purchase_order_id, existing_categories = [] } = req.body;

    if (!image_base64) {
      return res.status(400).json({
        success: false,
        error: 'Missing image_base64 in request body',
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'OPENAI_API_KEY not configured',
      });
    }

    console.log('Processing image for product extraction...');
    console.log('Existing categories:', existing_categories.length);

    // Remove data URL prefix if present
    const base64Image = image_base64.replace(/^data:image\/\w+;base64,/, '');

    // Fixed category taxonomy to prevent freestyle categories
    const allowedCategories = [
      "Grocery",
      "Toys",
      "Health & Beauty",
      "Stationary",
      "Electronics",
      "Sporting Goods",
      "Housewares",
      "Clothing",
      "Seasonal",
      "Misc",
    ];

    // Build category context for AI (reference only; still enforced after)
    let categoryContext = `\n\nCategory Schema (choose exactly one):\n${JSON.stringify(allowedCategories)}\n`;

    // Call OpenAI Vision API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // or 'gpt-4-turbo' for vision
      messages: [
        {
          role: 'system',
          content: `You are labeling retail products for a POS system.

STRICT RULES:
1) Do NOT invent creative or unique names.
2) DO extract brand names if they are clearly visible on the product (logos, text, packaging).
3) Do NOT infer brands that are not visible - only extract what you can actually see.
4) Do NOT add adjectives unless they describe a visible variant.
5) Extract additional product details ONLY if they are clearly visible on the product.

Naming Schema:
- base_name: Generic product type only (e.g., "Toy Car", "Hand Sanitizer", "USB Flash Drive", "Nicotine Pouches").
- variant: Only visible distinguishing attributes (e.g., "White", "Red", "32GB", "Sports Car Style", "Citrus").
- brand: Brand name if clearly visible on the product (e.g., "ZYN", "Coca-Cola", "Nike"). Leave empty string "" if no brand is visible.

Optional Fields (extract ONLY if clearly visible):
- guessed_size: Product size if visible (e.g., "12 oz", "Large", "500ml", "6 count"). Leave empty string "" if not visible.
- color: Product color if visible (e.g., "Red", "Blue", "White"). Leave empty string "" if not visible.
- pack_size: Pack size or quantity if visible (e.g., "12 pack", "24 count", "3 oz"). Leave empty string "" if not visible.
- price: MSRP or retail price if visible on packaging or label. Extract as a number (e.g., 4.99, 12.50). Leave null if not visible.
- sku: UPC barcode number if visible. Extract as a string of digits (e.g., "012345678901"). Leave empty string "" if not visible.

Category Schema (choose EXACTLY one from this list):
${JSON.stringify(allowedCategories)}
${categoryContext}

OUTPUT JSON ONLY (no markdown, no code fences, no prose):
{
  "base_name": "...",
  "variant": "...",
  "brand": "...",
  "category": "...",
  "guessed_size": "...",
  "color": "...",
  "pack_size": "...",
  "price": null,
  "sku": "...",
  "keywords": ["keyword1", "keyword2", "keyword3", ...]
}

IMPORTANT: The "keywords" field should contain 5-10 searchable words or phrases that would help match this product in the future. Include:
- The main product name/type (e.g., "toad", "amiibo", "figure")
- Character names if applicable (e.g., "toad", "mario")
- Product type variations (e.g., "toy", "action figure", "collectible")
- Brand names if visible
- Any distinctive features visible on the product

This helps the system match products even when the exact name differs.`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 300, // Reduced for faster response
      temperature: 0.2, // Lower temperature for more consistent extraction
    });

    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Check if OpenAI indicates it can't extract product information
    const lowerContent = content.toLowerCase();
    const cannotExtractIndicators = [
      "i'm unable to extract",
      "unable to extract",
      "cannot extract",
      "no relevant product information",
      "unable to identify",
      "cannot identify",
      "no product information",
      "please provide more context",
      "clearer image"
    ];
    
    const cannotExtract = cannotExtractIndicators.some(indicator => 
      lowerContent.includes(indicator)
    );
    
    if (cannotExtract) {
      console.log('OpenAI unable to extract product information from image (likely invalid crop)');
      return res.json({
        success: false,
        error: 'Unable to extract product information from image',
        skipped: true, // Flag to indicate this was skipped, not an error
      });
    }

    // Parse JSON response (handle markdown code blocks if present)
    let productData;
    try {
      const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      productData = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', content);
      if (cannotExtractIndicators.some(indicator => lowerContent.includes(indicator))) {
        console.log('OpenAI unable to extract product information (detected in parse error)');
        return res.json({
          success: false,
          error: 'Unable to extract product information from image',
          skipped: true,
        });
      }
      // If parsing fails but not due to "cannot extract", treat as skipped (don't throw)
      console.log('Failed to parse product data from AI response - treating as skipped');
      return res.json({
        success: false,
        error: 'Unable to extract product information from image',
        skipped: true,
      });
    }

    // Normalize and enforce schema
    const normalizeCategory = (cat) => {
      if (!cat || typeof cat !== 'string') return 'Misc'; // Default fallback
      const normalized = cat.trim().toLowerCase();
      // Try exact match first
      const exactMatch = allowedCategories.find(c => c.toLowerCase() === normalized);
      if (exactMatch) return exactMatch;
      // Try partial matches for common variations
      if (normalized.includes('health') || normalized.includes('beauty')) return 'Health & Beauty';
      if (normalized.includes('stationery') || normalized.includes('stationary')) return 'Stationary';
      if (normalized.includes('sport')) return 'Sporting Goods';
      if (normalized.includes('houseware') || normalized.includes('household')) return 'Housewares';
      // Default fallback
      return 'Misc';
    };

    const baseName = (productData.base_name || productData.name || '').toString().trim();
    const variant = (productData.variant || '').toString().trim();
    const brand = (productData.brand || '').toString().trim();
    // Extract keywords - ensure it's an array
    const keywords = Array.isArray(productData.keywords) 
      ? productData.keywords.map(k => k.toString().toLowerCase().trim()).filter(k => k.length > 0)
      : [];
    const category = normalizeCategory(productData.category);
    
    // Optional fields - extract if present, otherwise null/empty
    const guessedSize = (productData.guessed_size || '').toString().trim() || null;
    const color = (productData.color || '').toString().trim() || null;
    const packSize = (productData.pack_size || '').toString().trim() || null;
    const sku = (productData.sku || '').toString().trim() || null;
    
    // Price - extract as number if present, otherwise null
    let price = null;
    if (productData.price !== undefined && productData.price !== null && productData.price !== '') {
      const priceNum = parseFloat(productData.price);
      if (!isNaN(priceNum) && priceNum > 0) {
        price = priceNum;
      }
    }

    if (!baseName) {
      // Missing required field - treat as skipped, not error
      console.log('AI response missing required field: base_name - treating as skipped');
      return res.json({
        success: false,
        error: 'Unable to extract product information from image',
        skipped: true,
      });
    }

    // Build canonical name: include brand if present, then base name, then variant
    let canonicalName = baseName;
    if (brand) {
      canonicalName = `${brand} ${baseName}`;
    }
    if (variant) {
      canonicalName = `${canonicalName} - ${variant}`;
    }

    const normalizedPayload = {
      name: canonicalName,
      base_name: baseName,
      variant,
      brand: brand || null, // Store brand separately, null if empty
      category,
      guessed_size: guessedSize,
      color: color,
      pack_size: packSize,
      price: price, // MSRP if visible, null otherwise
      sku: sku, // UPC/barcode if visible, null otherwise
      keywords: keywords.length > 0 ? keywords : null, // Store keywords for matching
    };

    console.log('Successfully extracted product data (canonical):', normalizedPayload);

    res.json({
      success: true,
      ...normalizedPayload,
    });
  } catch (error) {
    console.error('Error in receive-item:', error);
    
    // Check if error is related to parsing/processing - treat as skipped, not error
    const errorMsg = error.message || '';
    if (errorMsg.includes('parse') || errorMsg.includes('AI response') || errorMsg.includes('missing required field') || errorMsg.includes('extract')) {
      console.log('Error is parsing/processing-related - treating as skipped item');
      return res.json({
        success: false,
        error: 'Unable to extract product information from image',
        skipped: true,
      });
    }
    
    // Only return 500 for actual server errors (network, OpenAI API failures, etc.)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process image',
    });
  }
}

