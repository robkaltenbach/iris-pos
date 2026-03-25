// Supabase storage utilities for image uploads
import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system/legacy';

const STORAGE_BUCKET = 'product-images'; // You'll need to create this bucket in Supabase

/**
 * Upload image to Supabase storage
 * @param imageUri - Local file URI from camera (file://...)
 * @param fileName - Optional custom filename (defaults to UUID)
 * @returns Public URL of uploaded image
 */
export async function uploadImageToStorage(
  imageUri: string,
  fileName?: string
): Promise<string> {
  try {
    console.log('Starting image upload, URI:', imageUri);
    
    // Generate unique filename if not provided
    const fileExtension = imageUri.split('.').pop() || 'jpg';
    const uniqueFileName = fileName || `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
    const filePath = `${uniqueFileName}`;

    // Read file as base64 using expo-file-system
    let base64: string;
    try {
      base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: 'base64' as any,
      });
      console.log('File read successfully, size:', base64.length, 'chars');
    } catch (readError) {
      console.error('Error reading file:', readError);
      throw new Error(`Failed to read image file: ${readError instanceof Error ? readError.message : 'Unknown error'}`);
    }

    // Convert base64 to ArrayBuffer for Supabase
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const arrayBuffer = byteArray.buffer;

    // Upload to Supabase storage
    console.log('Uploading to Supabase storage...');
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }

    console.log('Upload successful, getting public URL...');

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      throw new Error('Failed to get public URL for uploaded image');
    }

    console.log('Image uploaded successfully, URL:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error in uploadImageToStorage:', error);
    throw error;
  }
}

