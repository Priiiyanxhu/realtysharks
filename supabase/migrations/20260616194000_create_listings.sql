-- Create the listings table
CREATE TABLE IF NOT EXISTS public.listings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  broker_id uuid REFERENCES public.profiles(auth_id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  price numeric NOT NULL,
  location text NOT NULL,
  bhk text NOT NULL,
  property_type text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  image_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

-- Listings RLS Policies
CREATE POLICY "Listings are viewable by everyone."
  ON public.listings FOR SELECT
  USING (true);

CREATE POLICY "Brokers can insert their own listings."
  ON public.listings FOR INSERT
  WITH CHECK (auth.uid() = broker_id);

CREATE POLICY "Brokers can update their own listings."
  ON public.listings FOR UPDATE
  USING (auth.uid() = broker_id);

CREATE POLICY "Brokers can delete their own listings."
  ON public.listings FOR DELETE
  USING (auth.uid() = broker_id);

-- Create Storage Bucket for listing images
INSERT INTO storage.buckets (id, name, public) VALUES ('listing-images', 'listing-images', true) ON CONFLICT DO NOTHING;

-- Storage RLS Policies for listing-images
DROP POLICY IF EXISTS "Listing images are publicly accessible." ON storage.objects;
CREATE POLICY "Listing images are publicly accessible." ON storage.objects FOR SELECT USING (bucket_id = 'listing-images');

DROP POLICY IF EXISTS "Anyone can upload a listing image." ON storage.objects;
CREATE POLICY "Anyone can upload a listing image." ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'listing-images');

DROP POLICY IF EXISTS "Listing image all access" ON storage.objects;
CREATE POLICY "Listing image all access" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'listing-images') WITH CHECK (bucket_id = 'listing-images');
