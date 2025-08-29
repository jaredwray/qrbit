use image::{ImageBuffer, Rgba, RgbaImage, imageops};
use imageproc::drawing::draw_filled_rect_mut;
use imageproc::rect::Rect;
use napi::bindgen_prelude::*;
use napi_derive::napi;
use qrcode::QrCode;
use std::io::Cursor;

#[napi(object)]
pub struct QrOptions {
    pub text: String,
    pub size: Option<u32>,
    pub margin: Option<u32>,
    pub logo_path: Option<String>,
    pub logo_size_ratio: Option<f64>,
    pub background_color: Option<String>,
    pub foreground_color: Option<String>,
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
    pub fn new(text: &str, size: u32, margin: u32) -> napi::Result<Self> {
        let code = QrCode::new(text).map_err(|e| Error::from_reason(format!("QR code generation failed: {}", e)))?;
        
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
            
            let logo_image = SvgImage::new()
                .set("x", center_x)
                .set("y", center_y)
                .set("width", logo_size)
                .set("height", logo_size)
                .set("href", logo_path);
            
            document = document.add(logo_image);
        }
        
        Ok(document.to_string())
    }

    pub fn generate_png(&self, logo_path: Option<&str>, logo_size_ratio: f64) -> napi::Result<Vec<u8>> {
        let mut img = self.generate_image();
        
        if let Some(logo_path) = logo_path {
            img = self.add_logo(img, logo_path, logo_size_ratio)?;
        }
        
        let mut buffer = Vec::new();
        let mut cursor = Cursor::new(&mut buffer);
        
        img.write_to(&mut cursor, image::ImageFormat::Png)
            .map_err(|e| Error::from_reason(format!("Failed to encode PNG: {}", e)))?;
        
        Ok(buffer)
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
pub fn generate_qr(options: QrOptions) -> Result<QrResult> {
    let size = options.size.unwrap_or(200);
    let margin = options.margin.unwrap_or(20);
    let logo_size_ratio = options.logo_size_ratio.unwrap_or(0.2);
    
    let mut generator = QrGenerator::new(&options.text, size, margin)?;
    
    if let Some(bg_color) = &options.background_color {
        let bg = parse_color(bg_color)?;
        let fg = if let Some(fg_color) = &options.foreground_color {
            parse_color(fg_color)?
        } else {
            [0, 0, 0, 255]
        };
        generator.set_colors(bg, fg);
    }
    
    let svg = generator.generate_svg(
        options.logo_path.as_deref(), 
        logo_size_ratio
    )?;
    
    let png_data = generator.generate_png(
        options.logo_path.as_deref(), 
        logo_size_ratio
    )?;
    
    let total_size = size + 2 * margin;
    
    Ok(QrResult {
        svg: Some(svg),
        png: Some(png_data.into()),
        width: total_size,
        height: total_size,
    })
}