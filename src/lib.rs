use image::{ImageBuffer, Rgba, RgbaImage, imageops};
use imageproc::drawing::draw_filled_rect_mut;
use imageproc::rect::Rect;
use napi::bindgen_prelude::*;
use napi_derive::napi;
use qrcode::{QrCode, EcLevel};

#[napi(object)]
pub struct QrOptions {
    pub text: String,
    pub size: Option<u32>,
    pub margin: Option<u32>,
    pub logo_path: Option<String>,
    pub logo_size_ratio: Option<f64>,
    pub background_color: Option<String>,
    pub foreground_color: Option<String>,
    pub error_correction: Option<String>,
}

#[napi(object)]
pub struct QrOptionsWithBuffer {
    pub text: String,
    pub size: Option<u32>,
    pub margin: Option<u32>,
    pub logo_buffer: Option<Buffer>,
    pub logo_size_ratio: Option<f64>,
    pub background_color: Option<String>,
    pub foreground_color: Option<String>,
    pub error_correction: Option<String>,
}

#[napi(object)]
pub struct QrResult {
    pub svg: Option<String>,
    pub png: Option<Buffer>,
    pub width: u32,
    pub height: u32,
}

pub struct QrGenerator {
    code: QrCode,
    size: u32,
    margin: u32,
    background_color: [u8; 4],
    foreground_color: [u8; 4],
}

impl QrGenerator {
    pub fn new(text: &str, size: u32, margin: u32, ec_level: EcLevel) -> napi::Result<Self> {
        let code = QrCode::with_error_correction_level(text, ec_level).map_err(|e| Error::from_reason(format!("QR code generation failed: {}", e)))?;
        
        Ok(Self {
            code,
            size,
            margin,
            background_color: [255, 255, 255, 255], // white
            foreground_color: [0, 0, 0, 255],       // black
        })
    }

    pub fn set_colors(&mut self, bg: [u8; 4], fg: [u8; 4]) {
        self.background_color = bg;
        self.foreground_color = fg;
    }

    pub fn generate_image(&self) -> RgbaImage {
        let qr_width = self.code.width();
        let module_size = self.size / qr_width as u32;
        let total_size = self.size + 2 * self.margin;
        
        let mut img = ImageBuffer::from_pixel(total_size, total_size, Rgba(self.background_color));
        
        for (y, row) in self.code.render::<char>().quiet_zone(false).build().lines().enumerate() {
            for (x, pixel) in row.chars().enumerate() {
                if pixel == '█' {
                    let start_x = self.margin + x as u32 * module_size;
                    let start_y = self.margin + y as u32 * module_size;
                    
                    draw_filled_rect_mut(
                        &mut img,
                        Rect::at(start_x as i32, start_y as i32).of_size(module_size, module_size),
                        Rgba(self.foreground_color)
                    );
                }
            }
        }
        
        img
    }

    pub fn add_logo(&self, mut img: RgbaImage, logo_path: &str, logo_size_ratio: f64) -> napi::Result<RgbaImage> {
        let logo = image::open(logo_path)
            .map_err(|e| Error::from_reason(format!("Failed to open logo: {}", e)))?
            .to_rgba8();
        
        let logo_size = ((self.size as f64) * logo_size_ratio) as u32;
        let resized_logo = imageops::resize(&logo, logo_size, logo_size, imageops::FilterType::Lanczos3);
        
        let center_x = (img.width() - logo_size) / 2;
        let center_y = (img.height() - logo_size) / 2;
        
        imageops::overlay(&mut img, &resized_logo, center_x as i64, center_y as i64);
        
        Ok(img)
    }

    pub fn add_logo_from_buffer(&self, mut img: RgbaImage, logo_buffer: &[u8], logo_size_ratio: f64) -> napi::Result<RgbaImage> {
        let logo = image::load_from_memory(logo_buffer)
            .map_err(|e| Error::from_reason(format!("Failed to load logo from buffer: {}", e)))?
            .to_rgba8();
        
        let logo_size = ((self.size as f64) * logo_size_ratio) as u32;
        let resized_logo = imageops::resize(&logo, logo_size, logo_size, imageops::FilterType::Lanczos3);
        
        let center_x = (img.width() - logo_size) / 2;
        let center_y = (img.height() - logo_size) / 2;
        
        imageops::overlay(&mut img, &resized_logo, center_x as i64, center_y as i64);
        
        Ok(img)
    }

    pub fn generate_svg(&self, logo_path: Option<&str>, logo_size_ratio: f64) -> napi::Result<String> {
        use svg::node::element::{Rectangle, Image as SvgImage};
        use svg::Document;
        
        let qr_width = self.code.width();
        let module_size = self.size as f64 / qr_width as f64;
        let total_size = self.size as f64 + 2.0 * self.margin as f64;
        
        let mut document = Document::new()
            .set("width", total_size)
            .set("height", total_size)
            .set("viewBox", (0, 0, total_size as i32, total_size as i32));
        
        // Background
        let bg_color = format!("rgb({},{},{})", 
            self.background_color[0], 
            self.background_color[1], 
            self.background_color[2]
        );
        let background = Rectangle::new()
            .set("width", "100%")
            .set("height", "100%")
            .set("fill", bg_color);
        document = document.add(background);
        
        // QR modules
        let fg_color = format!("rgb({},{},{})", 
            self.foreground_color[0], 
            self.foreground_color[1], 
            self.foreground_color[2]
        );
        
        for (y, row) in self.code.render::<char>().quiet_zone(false).build().lines().enumerate() {
            for (x, pixel) in row.chars().enumerate() {
                if pixel == '█' {
                    let start_x = self.margin as f64 + x as f64 * module_size;
                    let start_y = self.margin as f64 + y as f64 * module_size;
                    
                    let rect = Rectangle::new()
                        .set("x", start_x)
                        .set("y", start_y)
                        .set("width", module_size)
                        .set("height", module_size)
                        .set("fill", fg_color.as_str());
                    
                    document = document.add(rect);
                }
            }
        }
        
        // Add logo if provided
        if let Some(logo_path) = logo_path {
            let logo_size = (self.size as f64) * logo_size_ratio;
            let center_x = (total_size - logo_size) / 2.0;
            let center_y = (total_size - logo_size) / 2.0;
            
            // Read logo file and convert to base64 data URL
            let data_url = match std::fs::read(logo_path) {
                Ok(logo_buffer) => {
                    use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
                    let base64_data = BASE64.encode(&logo_buffer);
                    format!("data:image/png;base64,{}", base64_data)
                },
                Err(_) => {
                    // Fallback to file path if reading fails
                    logo_path.to_string()
                }
            };
            
            let logo_image = SvgImage::new()
                .set("x", center_x)
                .set("y", center_y)
                .set("width", logo_size)
                .set("height", logo_size)
                .set("href", data_url);
            
            document = document.add(logo_image);
        }
        
        Ok(document.to_string())
    }

    pub fn generate_svg_with_buffer(&self, logo_buffer: Option<&[u8]>, logo_size_ratio: f64) -> napi::Result<String> {
        use svg::node::element::{Rectangle, Image as SvgImage};
        use svg::Document;
        
        let qr_width = self.code.width();
        let module_size = self.size as f64 / qr_width as f64;
        let total_size = self.size as f64 + 2.0 * self.margin as f64;
        
        let mut document = Document::new()
            .set("width", total_size)
            .set("height", total_size)
            .set("viewBox", (0, 0, total_size as i32, total_size as i32));
        
        // Background
        let bg_color = format!("rgb({},{},{})", 
            self.background_color[0], 
            self.background_color[1], 
            self.background_color[2]
        );
        let background = Rectangle::new()
            .set("width", "100%")
            .set("height", "100%")
            .set("fill", bg_color);
        document = document.add(background);
        
        // QR modules
        let fg_color = format!("rgb({},{},{})", 
            self.foreground_color[0], 
            self.foreground_color[1], 
            self.foreground_color[2]
        );
        
        for (y, row) in self.code.render::<char>().quiet_zone(false).build().lines().enumerate() {
            for (x, pixel) in row.chars().enumerate() {
                if pixel == '█' {
                    let start_x = self.margin as f64 + x as f64 * module_size;
                    let start_y = self.margin as f64 + y as f64 * module_size;
                    
                    let rect = Rectangle::new()
                        .set("x", start_x)
                        .set("y", start_y)
                        .set("width", module_size)
                        .set("height", module_size)
                        .set("fill", fg_color.as_str());
                    
                    document = document.add(rect);
                }
            }
        }
        
        // Add logo if provided
        if let Some(logo_buffer) = logo_buffer {
            let logo_size = (self.size as f64) * logo_size_ratio;
            let center_x = (total_size - logo_size) / 2.0;
            let center_y = (total_size - logo_size) / 2.0;
            
            // Convert buffer to base64 data URL
            use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
            let base64_data = BASE64.encode(logo_buffer);
            let data_url = format!("data:image/png;base64,{}", base64_data);
            
            let logo_image = SvgImage::new()
                .set("x", center_x)
                .set("y", center_y)
                .set("width", logo_size)
                .set("height", logo_size)
                .set("href", data_url);
            
            document = document.add(logo_image);
        }
        
        Ok(document.to_string())
    }

}

fn parse_ec_level(level_str: Option<&str>) -> EcLevel {
    match level_str.unwrap_or("M").to_uppercase().as_str() {
        "L" => EcLevel::L,
        "M" => EcLevel::M,
        "Q" => EcLevel::Q,
        "H" => EcLevel::H,
        _ => EcLevel::M,
    }
}

fn parse_color(color_str: &str) -> napi::Result<[u8; 4]> {
    if color_str.starts_with('#') && color_str.len() == 7 {
        let r = u8::from_str_radix(&color_str[1..3], 16)
            .map_err(|_| Error::from_reason("Invalid color format"))?;
        let g = u8::from_str_radix(&color_str[3..5], 16)
            .map_err(|_| Error::from_reason("Invalid color format"))?;
        let b = u8::from_str_radix(&color_str[5..7], 16)
            .map_err(|_| Error::from_reason("Invalid color format"))?;
        Ok([r, g, b, 255])
    } else {
        Err(Error::from_reason("Color must be in #RRGGBB format"))
    }
}


#[napi]
pub fn generate_qr_svg(options: QrOptions) -> Result<String> {
    let size = options.size.unwrap_or(200);
    let margin = options.margin.unwrap_or(20);
    let logo_size_ratio = options.logo_size_ratio.unwrap_or(0.2);
    let ec_level = parse_ec_level(options.error_correction.as_deref());

    let mut generator = QrGenerator::new(&options.text, size, margin, ec_level)?;

    if let Some(bg_color) = &options.background_color {
        let bg = parse_color(bg_color)?;
        let fg = if let Some(fg_color) = &options.foreground_color {
            parse_color(fg_color)?
        } else {
            [0, 0, 0, 255]
        };
        generator.set_colors(bg, fg);
    }

    generator.generate_svg(
        options.logo_path.as_deref(), 
        logo_size_ratio
    )
}


#[napi]
pub fn generate_qr_svg_with_buffer(options: QrOptionsWithBuffer) -> Result<String> {
    let size = options.size.unwrap_or(200);
    let margin = options.margin.unwrap_or(20);
    let logo_size_ratio = options.logo_size_ratio.unwrap_or(0.2);
    let ec_level = parse_ec_level(options.error_correction.as_deref());

    let mut generator = QrGenerator::new(&options.text, size, margin, ec_level)?;
    
    if let Some(bg_color) = &options.background_color {
        let bg = parse_color(bg_color)?;
        let fg = if let Some(fg_color) = &options.foreground_color {
            parse_color(fg_color)?
        } else {
            [0, 0, 0, 255]
        };
        generator.set_colors(bg, fg);
    }

    let logo_buffer = options.logo_buffer.as_ref().map(|b| b.as_ref());

    generator.generate_svg_with_buffer(
        logo_buffer,
        logo_size_ratio
    )
}


#[napi]
pub fn convert_svg_to_png(svg_content: String, width: Option<u32>, height: Option<u32>) -> Result<Buffer> {
    use resvg::usvg;
    use resvg::tiny_skia;

    // Parse the SVG content into uSVG tree with medium-quality options
    let mut options = usvg::Options::default();
    options.shape_rendering = usvg::ShapeRendering::CrispEdges;
    options.text_rendering = usvg::TextRendering::OptimizeSpeed;
    options.image_rendering = usvg::ImageRendering::OptimizeQuality;
    options.default_size = usvg::Size::from_wh(200.0, 200.0).unwrap(); // Medium default resolution

    let tree = usvg::Tree::from_str(&svg_content, &options)
        .map_err(|e| Error::from_reason(format!("Failed to parse SVG: {}", e)))?;

    // Get the tree size or use provided dimensions with medium scaling
    let tree_size = tree.size();
    let scale_factor = if width.is_none() && height.is_none() { 2.0 } else { 2.0 }; // 2x supersampling for medium quality

    let pixmap_width = width.unwrap_or((tree_size.width() * scale_factor) as u32);
    let pixmap_height = height.unwrap_or((tree_size.height() * scale_factor) as u32);

    // Create a pixmap buffer with alpha for better quality
    let mut pixmap = tiny_skia::Pixmap::new(pixmap_width, pixmap_height)
        .ok_or_else(|| Error::from_reason("Failed to create pixmap"))?;

    // Clear with transparent background for better quality
    pixmap.fill(tiny_skia::Color::TRANSPARENT);

    // Calculate the transform to scale the SVG to fit the pixmap with high quality scaling
    let scale_x = pixmap_width as f32 / tree_size.width();
    let scale_y = pixmap_height as f32 / tree_size.height();
    let transform = tiny_skia::Transform::from_scale(scale_x, scale_y);

    // Render the SVG to the pixmap with high quality settings
    resvg::render(&tree, transform, &mut pixmap.as_mut());

    // Convert pixmap to PNG bytes with high quality settings
    let png_data = pixmap.encode_png()
        .map_err(|e| Error::from_reason(format!("Failed to encode PNG: {}", e)))?;

    Ok(png_data.into())
}

#[napi]
pub fn convert_svg_to_jpeg(svg_content: String, width: Option<u32>, height: Option<u32>, quality: Option<u8>) -> Result<Buffer> {
    use resvg::usvg;
    use resvg::tiny_skia;
    use std::io::Cursor;

    // Parse the SVG content into uSVG tree with medium-quality options
    let mut options = usvg::Options::default();
    options.shape_rendering = usvg::ShapeRendering::CrispEdges;
    options.text_rendering = usvg::TextRendering::OptimizeSpeed;
    options.image_rendering = usvg::ImageRendering::OptimizeQuality;
    options.default_size = usvg::Size::from_wh(200.0, 200.0).unwrap(); // Medium default resolution

    let tree = usvg::Tree::from_str(&svg_content, &options)
        .map_err(|e| Error::from_reason(format!("Failed to parse SVG: {}", e)))?;

    // Get the tree size or use provided dimensions with medium scaling
    let tree_size = tree.size();
    let scale_factor = if width.is_none() && height.is_none() { 2.0 } else { 2.0 }; // 2x supersampling for medium quality

    let pixmap_width = width.unwrap_or((tree_size.width() * scale_factor) as u32);
    let pixmap_height = height.unwrap_or((tree_size.height() * scale_factor) as u32);

    // Create a pixmap buffer with white background (JPEG doesn't support transparency)
    let mut pixmap = tiny_skia::Pixmap::new(pixmap_width, pixmap_height)
        .ok_or_else(|| Error::from_reason("Failed to create pixmap"))?;

    // Clear with white background (JPEG doesn't support transparency)
    pixmap.fill(tiny_skia::Color::WHITE);

    // Calculate the transform to scale the SVG to fit the pixmap with high quality scaling
    let scale_x = pixmap_width as f32 / tree_size.width();
    let scale_y = pixmap_height as f32 / tree_size.height();
    let transform = tiny_skia::Transform::from_scale(scale_x, scale_y);

    // Render the SVG to the pixmap with high quality settings
    resvg::render(&tree, transform, &mut pixmap.as_mut());

    // Convert pixmap to RGB image (JPEG doesn't support alpha channel)
    let rgb_image = image::RgbImage::from_raw(
        pixmap_width,
        pixmap_height,
        pixmap.data()
            .chunks_exact(4)
            .flat_map(|rgba| [rgba[0], rgba[1], rgba[2]]) // Drop alpha channel
            .collect::<Vec<u8>>()
    ).ok_or_else(|| Error::from_reason("Failed to create RGB image"))?;

    // Encode as JPEG with specified quality (default: 90)
    let jpeg_quality = quality.unwrap_or(90).clamp(1, 100);
    let mut jpeg_buffer = Vec::new();
    let mut cursor = Cursor::new(&mut jpeg_buffer);

    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut cursor, jpeg_quality);
    encoder.encode(
        rgb_image.as_raw(),
        pixmap_width,
        pixmap_height,
        image::ExtendedColorType::Rgb8
    ).map_err(|e| Error::from_reason(format!("Failed to encode JPEG: {}", e)))?;

    Ok(jpeg_buffer.into())
}

#[napi]
pub fn convert_svg_to_webp(svg_content: String, width: Option<u32>, height: Option<u32>, _quality: Option<u8>) -> Result<Buffer> {
    use resvg::usvg;
    use resvg::tiny_skia;
    use std::io::Cursor;

    // Parse the SVG content into uSVG tree with medium-quality options
    let mut options = usvg::Options::default();
    options.shape_rendering = usvg::ShapeRendering::CrispEdges;
    options.text_rendering = usvg::TextRendering::OptimizeSpeed;
    options.image_rendering = usvg::ImageRendering::OptimizeQuality;
    options.default_size = usvg::Size::from_wh(200.0, 200.0).unwrap();

    let tree = usvg::Tree::from_str(&svg_content, &options)
        .map_err(|e| Error::from_reason(format!("Failed to parse SVG: {}", e)))?;

    // Get the tree size or use provided dimensions with medium scaling
    let tree_size = tree.size();
    let scale_factor = if width.is_none() && height.is_none() { 2.0 } else { 2.0 };

    let pixmap_width = width.unwrap_or((tree_size.width() * scale_factor) as u32);
    let pixmap_height = height.unwrap_or((tree_size.height() * scale_factor) as u32);

    // Create a pixmap buffer with transparent background (WebP supports transparency)
    let mut pixmap = tiny_skia::Pixmap::new(pixmap_width, pixmap_height)
        .ok_or_else(|| Error::from_reason("Failed to create pixmap"))?;

    // Clear with transparent background (WebP supports alpha channel)
    pixmap.fill(tiny_skia::Color::TRANSPARENT);

    // Calculate the transform to scale the SVG to fit the pixmap
    let scale_x = pixmap_width as f32 / tree_size.width();
    let scale_y = pixmap_height as f32 / tree_size.height();
    let transform = tiny_skia::Transform::from_scale(scale_x, scale_y);

    // Render the SVG to the pixmap
    resvg::render(&tree, transform, &mut pixmap.as_mut());

    // Keep RGBA data (WebP supports alpha channel)
    let rgba_image = image::RgbaImage::from_raw(
        pixmap_width,
        pixmap_height,
        pixmap.data().to_vec()
    ).ok_or_else(|| Error::from_reason("Failed to create RGBA image"))?;

    // Encode as WebP lossless
    let mut webp_buffer = Vec::new();
    let cursor = Cursor::new(&mut webp_buffer);

    let encoder = image::codecs::webp::WebPEncoder::new_lossless(cursor);
    encoder.encode(
        rgba_image.as_raw(),
        pixmap_width,
        pixmap_height,
        image::ExtendedColorType::Rgba8
    ).map_err(|e| Error::from_reason(format!("Failed to encode WebP: {}", e)))?;

    Ok(webp_buffer.into())
}