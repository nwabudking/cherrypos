# Storage Buckets Information

## Configured Buckets

### menu-images
- **Is Public:** Yes
- **Purpose:** Store menu item images
- **Files:** Currently empty (no files uploaded)

## Restoration Instructions

To recreate the storage bucket in a local Supabase instance:

```sql
-- Create the menu-images bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-images', 'menu-images', true);

-- Create RLS policies for the bucket
CREATE POLICY "Anyone can view menu images"
ON storage.objects FOR SELECT
USING (bucket_id = 'menu-images');

CREATE POLICY "Admins can upload menu images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'menu-images' 
  AND (
    has_role(auth.uid(), 'super_admin'::app_role) 
    OR has_role(auth.uid(), 'manager'::app_role)
  )
);

CREATE POLICY "Admins can delete menu images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'menu-images' 
  AND (
    has_role(auth.uid(), 'super_admin'::app_role) 
    OR has_role(auth.uid(), 'manager'::app_role)
  )
);
```

## Notes
- No files were found in storage at the time of backup
- If you have local files to upload, use the Supabase Storage API or dashboard
