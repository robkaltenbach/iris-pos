import dotenv from 'dotenv';
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';

dotenv.config();

/**
 * Generate image embedding using CLIP (via Roboflow) or Voyage AI
 * POST /ai/generate-embedding
 */
export async function generateEmbedding(req, res) {
  try {
    const { image_base64, image_uri, description } = req.body;

    // Prefer image_base64 over image_uri
    const imageData = image_base64 || image_uri;

    if (!imageData && !description) {
      return res.status(400).json({
        success: false,
        error: 'Missing image_base64/image_uri or description in request body',
      });
    }

    // Option 1: Try Roboflow CLIP first (Recommended for image search)
    if (process.env.ROBOFLOW_API_KEY && imageData) {
      try {
        return await generateRoboflowEmbedding(req, res, imageData);
      } catch (roboflowError) {
        console.warn('Roboflow embedding failed, trying fallback:', roboflowError.message);
        // Fall through to try other options
      }
    }

    // Option 2: Try Voyage AI
    if (process.env.VOYAGE_API_KEY && imageData) {
      try {
        return await generateVoyageEmbedding(req, res, imageData, description);
      } catch (voyageError) {
        console.warn('Voyage embedding failed, trying fallback:', voyageError.message);
        // Fall through to try OpenAI
      }
    }

    // Option 3: Fallback to OpenAI text embedding from description
    if (process.env.OPENAI_API_KEY && description) {
      console.log('Using OpenAI text embedding as fallback');
      return await generateOpenAITextEmbedding(req, res, description);
    }

    // No embedding provider configured
    res.status(500).json({
      success: false,
      error: 'No embedding provider configured. Set ROBOFLOW_API_KEY, VOYAGE_API_KEY, or OPENAI_API_KEY',
    });
  } catch (error) {
    console.error('Error generating embedding:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate embedding',
    });
  }
}

/**
 * Generate embedding using Roboflow CLIP
 */
async function generateRoboflowEmbedding(req, res, imageData) {
  try {
    // Handle base64 image (preferred)
    let imageBuffer;
    if (typeof imageData === 'string' && imageData.startsWith('data:image')) {
      // Handle data URL
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else if (typeof imageData === 'string' && imageData.length > 100) {
      // Assume it's base64 string (no data URL prefix)
      imageBuffer = Buffer.from(imageData, 'base64');
    } else if (imageData.startsWith('file://')) {
      // Handle file URI (shouldn't happen from frontend, but handle it)
      const filePath = imageData.replace('file://', '');
      imageBuffer = fs.readFileSync(filePath);
    } else if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
      // Handle URL
      const response = await fetch(imageData);
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    } else {
      throw new Error('Invalid image data format');
    }

    // Roboflow CLIP API expects JSON with base64 image, not form-data
    const apiKey = process.env.ROBOFLOW_API_KEY;
    console.log('Calling Roboflow CLIP API with key:', apiKey ? `${apiKey.substring(0, 5)}...` : 'MISSING');
    
    // Convert image buffer to base64
    const base64Image = imageBuffer.toString('base64');
    
    // Call Roboflow CLIP API with JSON body
    const roboflowResponse = await fetch(`https://infer.roboflow.com/clip/embed_image?api_key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: {
          type: 'base64',
          value: base64Image,
        },
      }),
    });

    if (!roboflowResponse.ok) {
      const errorText = await roboflowResponse.text();
      console.error('Roboflow API error:', roboflowResponse.status, errorText);
      throw new Error(`Roboflow API error: ${roboflowResponse.status} - ${errorText}`);
    }

    const data = await roboflowResponse.json();
    const embedding = data.embeddings || data.embedding || data;

    // Ensure it's an array
    const embeddingArray = Array.isArray(embedding) ? embedding : Object.values(embedding);

    res.json({
      success: true,
      embedding: embeddingArray,
    });
  } catch (error) {
    console.error('Roboflow embedding error:', error);
    throw error;
  }
}

/**
 * Generate embedding using Voyage AI
 */
async function generateVoyageEmbedding(req, res, imageData, description) {
  try {
    // Voyage AI expects base64 image
    let base64Image;
    if (typeof imageData === 'string' && imageData.startsWith('data:image')) {
      // Handle data URL
      base64Image = imageData.replace(/^data:image\/\w+;base64,/, '');
    } else if (typeof imageData === 'string' && imageData.length > 100) {
      // Assume it's base64 string (no data URL prefix)
      base64Image = imageData;
    } else if (imageData.startsWith('file://')) {
      // Handle file URI (shouldn't happen from frontend, but handle it)
      const filePath = imageData.replace('file://', '');
      const imageBuffer = fs.readFileSync(filePath);
      base64Image = imageBuffer.toString('base64');
    } else if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
      // Fetch and convert to base64
      const response = await fetch(imageData);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      base64Image = buffer.toString('base64');
    } else {
      throw new Error('Invalid image data format');
    }

    // Call Voyage AI API
    const voyageResponse = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({
        input: [
          {
            image: base64Image,
            text: description || '',
          },
        ],
        model: 'voyage-multimodal-2', // or 'voyage-large-2' for text-only
      }),
    });

    if (!voyageResponse.ok) {
      const errorText = await voyageResponse.text();
      throw new Error(`Voyage API error: ${voyageResponse.status} - ${errorText}`);
    }

    const data = await voyageResponse.json();
    const embedding = data.data[0]?.embedding;

    if (!embedding) {
      throw new Error('No embedding returned from Voyage AI');
    }

    res.json({
      success: true,
      embedding: embedding,
    });
  } catch (error) {
    console.error('Voyage embedding error:', error);
    throw error;
  }
}

/**
 * Fallback: Generate text embedding using OpenAI
 */
async function generateOpenAITextEmbedding(req, res, description) {
  const { OpenAI } = await import('openai');
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small', // or 'text-embedding-3-large'
      input: description,
    });

    const embedding = response.data[0]?.embedding;

    if (!embedding) {
      throw new Error('No embedding returned from OpenAI');
    }

    res.json({
      success: true,
      embedding: embedding,
    });
  } catch (error) {
    console.error('OpenAI text embedding error:', error);
    throw error;
  }
}

