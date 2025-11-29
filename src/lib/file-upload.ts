import { createClient } from '@/lib/supabase/client';

export interface UploadResult {
  success: boolean;
  path?: string;
  url?: string;
  error?: string;
}

/**
 * Upload an Excel file to Supabase Storage for import tracking
 */
export async function uploadImportFile(file: File): Promise<UploadResult> {
  const supabase = createClient();

  // Generate unique filename with timestamp
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `imports/${timestamp}_${sanitizedName}`;

  const { data, error } = await supabase.storage
    .from('imports')
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    console.error('File upload error:', error);
    return {
      success: false,
      error: error.message,
    };
  }

  // Get the public URL (or signed URL for private buckets)
  const { data: urlData } = supabase.storage
    .from('imports')
    .getPublicUrl(data.path);

  return {
    success: true,
    path: data.path,
    url: urlData.publicUrl,
  };
}

/**
 * Download an import file from Supabase Storage
 */
export async function downloadImportFile(path: string): Promise<Blob | null> {
  const supabase = createClient();

  const { data, error } = await supabase.storage
    .from('imports')
    .download(path);

  if (error) {
    console.error('File download error:', error);
    return null;
  }

  return data;
}

/**
 * Get a signed URL for downloading (for private buckets)
 */
export async function getSignedDownloadUrl(path: string, expiresIn = 3600): Promise<string | null> {
  const supabase = createClient();

  const { data, error } = await supabase.storage
    .from('imports')
    .createSignedUrl(path, expiresIn);

  if (error) {
    console.error('Signed URL error:', error);
    return null;
  }

  return data.signedUrl;
}
