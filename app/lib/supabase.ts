// @/lib/supabase.ts

/**
 * - Sign up account here
 * https://supabase.com/dashboard/sign-up?returnTo=%2Forg
 * 
 * - Learn how to use Supabase to store and serve files
 * @Buckets https://supabase.com/docs/guides/storage/quickstart?queryGroups=language&language=dashboard 
 * @Uploads https://supabase.com/docs/guides/storage/uploads/standard-uploads
*/

import { createClient } from "@supabase/supabase-js";
import { Logger } from "./logger";
import imageCompression from "browser-image-compression";

// Initialize Supabase Client
const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Bucket name in Supabase Storage
const BUCKET_NAME = "images-bucket"; 

/**
 * Uploads image file to Supabase Storage with compression and resizing
 * @param file - the image file from input
 * @param folder - the folder inside the bucket ("profiles" | "rooms"); default folder to "profiles"
 * @param replaceFileName - optional for overwriting existing files by name
 * @returns public image URL as string or null on error
*/
export async function clientUploadImageToSupabase(
  file: File,
  folder: "profiles" | "rooms" = "profiles",
  replaceFileName?: string,
): Promise<string | null> {
  try {
    // Resize and compress
    const compressedFile = await imageCompression(file, {
      maxSizeMB: 2, // Max file size 2MB
      maxWidthOrHeight: 1024, // Max size 1024px
      useWebWorker: true,
    });

    const fileName = replaceFileName
     ? `${folder}/${replaceFileName}`
     : `${folder}/${crypto.randomUUID()}-${compressedFile.name.replaceAll(" ", "_")}`;

    const { error } = await client.storage
      .from(BUCKET_NAME)
      .upload(fileName, compressedFile, {
        cacheControl: "3600",
        upsert: true,
      });
    
    if (error) throw error;

    return `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${fileName}`;
  } catch (error) {
    Logger.error("SUPABASE_CLIENT_SIDE_UPLOAD_FAILED", error as Error);
    return null;
  }
}