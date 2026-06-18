-- Image generation fields
alter table content_posts add column if not exists generated_image_url text;

-- Brand/image style guide per client
alter table clients add column if not exists image_style_guide text;
