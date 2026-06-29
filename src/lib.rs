use napi::bindgen_prelude::*;
use napi_derive::napi;
use quircs::Quirc;

mod nodeqr;
use nodeqr::{BitMatrix, EcLevel};

#[napi(object)]
pub struct QrOptions {
    pub text: String,
    pub size: Option<u32>,
    pub margin: Option<u32>,
    pub logo_path: Option<String>,
    pub logo_size_ratio: Option<f64>,
    pub logo_background_color: Option<String>,
    pub logo_padding_ratio: Option<f64>,
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
    pub logo_background_color: Option<String>,
    pub logo_padding_ratio: Option<f64>,
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
    matrix: BitMatrix,
    size: u32,
    margin: u32,
    background_color: [u8; 4],
    foreground_color: [u8; 4],
}

impl QrGenerator {
    pub fn new(text: &str, size: u32, margin: u32, ec_level: EcLevel) -> napi::Result<Self> {
        let matrix = nodeqr::create(text, ec_level)
            .map_err(|e| Error::from_reason(format!("QR code generation failed: {}", e)))?;

        Ok(Self {
            matrix,
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

    pub fn generate_svg(
        &self,
        logo_path: Option<&str>,
        logo_size_ratio: f64,
        logo_background_color: Option<[u8; 4]>,
        logo_padding_ratio: f64,
    ) -> napi::Result<String> {
        // Resolve the logo (if any) to a base64 PNG data URL, falling back to
        // the raw path as the href if the file cannot be read.
        let logo_data_url = logo_path.map(|path| match std::fs::read(path) {
            Ok(bytes) => encode_png_data_url(&bytes),
            Err(_) => path.to_string(),
        });

        Ok(self.build_svg(
            logo_data_url,
            logo_size_ratio,
            logo_background_color,
            logo_padding_ratio,
        ))
    }

    pub fn generate_svg_with_buffer(
        &self,
        logo_buffer: Option<&[u8]>,
        logo_size_ratio: f64,
        logo_background_color: Option<[u8; 4]>,
        logo_padding_ratio: f64,
    ) -> napi::Result<String> {
        let logo_data_url = logo_buffer.map(encode_png_data_url);

        Ok(self.build_svg(
            logo_data_url,
            logo_size_ratio,
            logo_background_color,
            logo_padding_ratio,
        ))
    }

    /// Shared SVG builder for the logo-capable rendering path. `logo_data_url`
    /// is the already-resolved `href` for the embedded logo image, or `None` to
    /// render the QR without a logo. QR modules are emitted as a single `<path>`
    /// (one subpath per horizontal run of dark modules) instead of one `<rect>`
    /// per module — visually identical, but far fewer nodes and much smaller
    /// output.
    fn build_svg(
        &self,
        logo_data_url: Option<String>,
        logo_size_ratio: f64,
        logo_background_color: Option<[u8; 4]>,
        logo_padding_ratio: f64,
    ) -> String {
        use svg::node::element::{Image as SvgImage, Path, Rectangle};
        use svg::Document;

        let qr_width = self.matrix.size;
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

        // QR modules — a single <path> with one subpath per horizontal run of
        // dark modules, in the same pixel coordinate space as the old per-rect
        // rendering (visually identical output).
        let fg_color = format!("rgb({},{},{})",
            self.foreground_color[0],
            self.foreground_color[1],
            self.foreground_color[2]
        );

        let mut d = String::new();
        for row in 0..qr_width {
            let mut col = 0;
            while col < qr_width {
                if self.matrix.get(row, col) != 0 {
                    let run_start = col;
                    while col < qr_width && self.matrix.get(row, col) != 0 {
                        col += 1;
                    }
                    let run_len = (col - run_start) as f64;
                    let x = self.margin as f64 + run_start as f64 * module_size;
                    let y = self.margin as f64 + row as f64 * module_size;
                    let w = run_len * module_size;
                    d.push_str(&format!("M{} {}h{}v{}h{}z", x, y, w, module_size, -w));
                } else {
                    col += 1;
                }
            }
        }

        if !d.is_empty() {
            let modules = Path::new().set("fill", fg_color).set("d", d);
            document = document.add(modules);
        }

        // Add logo if provided
        if let Some(data_url) = logo_data_url {
            let logo_size = (self.size as f64) * logo_size_ratio;
            let center_x = (total_size - logo_size) / 2.0;
            let center_y = (total_size - logo_size) / 2.0;

            // Knockout patch behind the logo so transparent areas don't reveal QR modules
            if let Some(patch_color) = logo_background_color {
                let patch_size = logo_size * (1.0 + 2.0 * logo_padding_ratio);
                let patch_x = (total_size - patch_size) / 2.0;
                let patch_y = (total_size - patch_size) / 2.0;
                let patch_fill = format!(
                    "rgb({},{},{})",
                    patch_color[0], patch_color[1], patch_color[2]
                );
                let patch = Rectangle::new()
                    .set("x", patch_x)
                    .set("y", patch_y)
                    .set("width", patch_size)
                    .set("height", patch_size)
                    .set("fill", patch_fill);
                document = document.add(patch);
            }

            let logo_image = SvgImage::new()
                .set("x", center_x)
                .set("y", center_y)
                .set("width", logo_size)
                .set("height", logo_size)
                .set("href", data_url);

            document = document.add(logo_image);
        }

        document.to_string()
    }

}

/// Encode raw image bytes as a base64 `data:image/png;base64,...` URL for
/// embedding directly in an SVG `<image>` href.
fn encode_png_data_url(bytes: &[u8]) -> String {
    use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
    format!("data:image/png;base64,{}", BASE64.encode(bytes))
}

fn parse_ec_level(level_str: Option<&str>) -> EcLevel {
    match level_str.unwrap_or("M").to_uppercase().as_str() {
        "L" | "LOW" => EcLevel::L,
        "M" | "MEDIUM" => EcLevel::M,
        "Q" | "QUARTILE" => EcLevel::Q,
        "H" | "HIGH" => EcLevel::H,
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

/// Parse an optional hex color, propagating parse errors and mapping `None`
/// through unchanged.
fn parse_optional_color(color_str: Option<&str>) -> Result<Option<[u8; 4]>> {
    match color_str {
        Some(color) => Ok(Some(parse_color(color)?)),
        None => Ok(None),
    }
}

/// Apply background/foreground colors to a generator when a background color is
/// provided, defaulting the foreground to black to match prior behavior.
fn apply_colors(
    generator: &mut QrGenerator,
    background: Option<&str>,
    foreground: Option<&str>,
) -> Result<()> {
    if background.is_some() || foreground.is_some() {
        let bg = match background {
            Some(bg_color) => parse_color(bg_color)?,
            None => generator.background_color,
        };
        let fg = match foreground {
            Some(fg_color) => parse_color(fg_color)?,
            None => generator.foreground_color,
        };
        generator.set_colors(bg, fg);
    }
    Ok(())
}


#[napi]
pub fn generate_qr_svg(options: QrOptions) -> Result<String> {
    let size = options.size.unwrap_or(200);
    let margin = options.margin.unwrap_or(20);
    let logo_size_ratio = options.logo_size_ratio.unwrap_or(0.2);
    let logo_padding_ratio = options.logo_padding_ratio.unwrap_or(0.1);
    let ec_level = parse_ec_level(options.error_correction.as_deref());

    let mut generator = QrGenerator::new(&options.text, size, margin, ec_level)?;
    apply_colors(
        &mut generator,
        options.background_color.as_deref(),
        options.foreground_color.as_deref(),
    )?;

    let logo_background_color = parse_optional_color(options.logo_background_color.as_deref())?;

    generator.generate_svg(
        options.logo_path.as_deref(),
        logo_size_ratio,
        logo_background_color,
        logo_padding_ratio,
    )
}


#[napi]
pub fn generate_qr_svg_with_buffer(options: QrOptionsWithBuffer) -> Result<String> {
    let size = options.size.unwrap_or(200);
    let margin = options.margin.unwrap_or(20);
    let logo_size_ratio = options.logo_size_ratio.unwrap_or(0.2);
    let logo_padding_ratio = options.logo_padding_ratio.unwrap_or(0.1);
    let ec_level = parse_ec_level(options.error_correction.as_deref());

    let mut generator = QrGenerator::new(&options.text, size, margin, ec_level)?;
    apply_colors(
        &mut generator,
        options.background_color.as_deref(),
        options.foreground_color.as_deref(),
    )?;

    let logo_background_color = parse_optional_color(options.logo_background_color.as_deref())?;

    let logo_buffer = options.logo_buffer.as_ref().map(|b| b.as_ref());

    generator.generate_svg_with_buffer(
        logo_buffer,
        logo_size_ratio,
        logo_background_color,
        logo_padding_ratio,
    )
}

#[napi(object)]
pub struct QrCodeSvgOptions {
    pub text: String,
    pub error_correction: Option<String>,
    /// Pixel width/height of the rendered SVG (maps to node-qrcode `width`).
    pub width: Option<u32>,
    /// Quiet-zone margin in modules (maps to node-qrcode `margin`, default 4).
    pub margin: Option<i32>,
    /// Foreground (dark module) color, hex string.
    pub dark_color: Option<String>,
    /// Background (light module) color, hex string.
    pub light_color: Option<String>,
}

/// Generate a QR code SVG string that is byte-for-byte identical to
/// `qrcode`'s `QRCode.toString(text, { type: 'svg', ... })`. This replaces the
/// JavaScript `qrcode` dependency for the no-logo rendering path.
#[napi]
pub fn generate_qr_code_svg(options: QrCodeSvgOptions) -> Result<String> {
    let ecl = nodeqr::EcLevel::from_str_or_m(options.error_correction.as_deref());
    nodeqr::render_svg(
        &options.text,
        ecl,
        options.width,
        options.margin.map(|m| m as i64),
        options.dark_color.as_deref(),
        options.light_color.as_deref(),
    )
    .map_err(Error::from_reason)
}


/// Parse an SVG string and render it to a tiny-skia pixmap at 2x supersampling
/// (or the explicit `width`/`height` when provided), filled with `background`
/// before rendering. Shared by the PNG/JPEG/WebP converters.
fn render_svg_to_pixmap(
    svg_content: &str,
    width: Option<u32>,
    height: Option<u32>,
    background: resvg::tiny_skia::Color,
) -> Result<resvg::tiny_skia::Pixmap> {
    use resvg::tiny_skia;
    use resvg::usvg;

    let mut options = usvg::Options::default();
    options.shape_rendering = usvg::ShapeRendering::CrispEdges;
    options.text_rendering = usvg::TextRendering::OptimizeSpeed;
    options.image_rendering = usvg::ImageRendering::OptimizeQuality;
    options.default_size = usvg::Size::from_wh(200.0, 200.0).unwrap();

    let tree = usvg::Tree::from_str(svg_content, &options)
        .map_err(|e| Error::from_reason(format!("Failed to parse SVG: {}", e)))?;

    // Default to 2x supersampling when no explicit dimensions are given. When
    // only one dimension is specified, scale the other proportionally to
    // preserve the SVG's aspect ratio instead of stretching it.
    let tree_size = tree.size();
    let (pixmap_width, pixmap_height) = match (width, height) {
        (Some(w), Some(h)) => (w, h),
        (Some(w), None) => {
            let h = (w as f32 * tree_size.height() / tree_size.width()) as u32;
            (w, h)
        }
        (None, Some(h)) => {
            let w = (h as f32 * tree_size.width() / tree_size.height()) as u32;
            (w, h)
        }
        (None, None) => (
            (tree_size.width() * 2.0) as u32,
            (tree_size.height() * 2.0) as u32,
        ),
    };

    let mut pixmap = tiny_skia::Pixmap::new(pixmap_width, pixmap_height)
        .ok_or_else(|| Error::from_reason("Failed to create pixmap"))?;
    pixmap.fill(background);

    let scale_x = pixmap_width as f32 / tree_size.width();
    let scale_y = pixmap_height as f32 / tree_size.height();
    let transform = tiny_skia::Transform::from_scale(scale_x, scale_y);

    resvg::render(&tree, transform, &mut pixmap.as_mut());

    Ok(pixmap)
}

#[napi]
pub fn convert_svg_to_png(svg_content: String, width: Option<u32>, height: Option<u32>) -> Result<Buffer> {
    use resvg::tiny_skia;

    // PNG supports alpha, so render onto a transparent background.
    let pixmap = render_svg_to_pixmap(&svg_content, width, height, tiny_skia::Color::TRANSPARENT)?;

    let png_data = pixmap
        .encode_png()
        .map_err(|e| Error::from_reason(format!("Failed to encode PNG: {}", e)))?;

    Ok(png_data.into())
}

#[napi]
pub fn convert_svg_to_jpeg(svg_content: String, width: Option<u32>, height: Option<u32>, quality: Option<u8>) -> Result<Buffer> {
    use resvg::tiny_skia;
    use std::io::Cursor;

    // JPEG has no alpha channel, so render onto an opaque white background.
    let pixmap = render_svg_to_pixmap(&svg_content, width, height, tiny_skia::Color::WHITE)?;
    let pixmap_width = pixmap.width();
    let pixmap_height = pixmap.height();

    // Convert pixmap to RGB image (drop the alpha channel)
    let rgb_image = image::RgbImage::from_raw(
        pixmap_width,
        pixmap_height,
        pixmap.data()
            .chunks_exact(4)
            .flat_map(|rgba| [rgba[0], rgba[1], rgba[2]])
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
    use resvg::tiny_skia;
    use std::io::Cursor;

    // WebP supports alpha, so render onto a transparent background.
    let pixmap = render_svg_to_pixmap(&svg_content, width, height, tiny_skia::Color::TRANSPARENT)?;
    let pixmap_width = pixmap.width();
    let pixmap_height = pixmap.height();

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

#[napi(object)]
pub struct DecodeResult {
    pub valid: bool,
    pub data: Option<String>,
    pub format: String,
    pub version: Option<u32>,
    pub ecl: Option<String>,
    pub error: Option<String>,
}

fn try_decode_luma(
    luma: &[u8],
    width: u32,
    height: u32,
) -> std::result::Result<DecodeResult, Option<String>> {
    let mut decoder = Quirc::new();
    let codes = decoder.identify(width as usize, height as usize, luma);
    let mut last_error: Option<String> = None;

    for code in codes {
        match code {
            Ok(code) => match code.decode() {
                Ok(data) => {
                    let ecl_str = match data.ecc_level {
                        quircs::EccLevel::L => "L",
                        quircs::EccLevel::M => "M",
                        quircs::EccLevel::Q => "Q",
                        quircs::EccLevel::H => "H",
                    };
                    let payload = String::from_utf8_lossy(&data.payload).to_string();
                    return Ok(DecodeResult {
                        valid: true,
                        data: Some(payload),
                        format: "qr".to_string(),
                        version: Some(data.version as u32),
                        ecl: Some(ecl_str.to_string()),
                        error: None,
                    });
                }
                Err(e) => last_error = Some(format!("QR decode failed: {}", e)),
            },
            Err(e) => last_error = Some(format!("QR identification failed: {}", e)),
        }
    }

    Err(last_error)
}

fn decode_qr_from_image(input: &[u8]) -> std::result::Result<DecodeResult, String> {
    let img = image::load_from_memory(input)
        .map_err(|e| format!("Failed to load image: {}", e))?;
    let mut gray = img.to_luma8();
    let (width, height) = gray.dimensions();

    match try_decode_luma(&gray, width, height) {
        Ok(result) => return Ok(result),
        Err(first_error) => {
            for p in gray.iter_mut() {
                *p = 255 - *p;
            }
            match try_decode_luma(&gray, width, height) {
                Ok(result) => return Ok(result),
                Err(second_error) => {
                    let error = second_error
                        .or(first_error)
                        .unwrap_or_else(|| "No QR code found in image".to_string());
                    Ok(DecodeResult {
                        valid: false,
                        data: None,
                        format: "qr".to_string(),
                        version: None,
                        ecl: None,
                        error: Some(error),
                    })
                }
            }
        }
    }
}

#[napi]
pub fn decode(input: Buffer) -> Result<Option<String>> {
    match decode_qr_from_image(&input) {
        Ok(result) => Ok(result.data),
        Err(e) => Err(Error::from_reason(e)),
    }
}

#[napi]
pub fn decode_detailed(input: Buffer) -> Result<DecodeResult> {
    match decode_qr_from_image(&input) {
        Ok(result) => Ok(result),
        Err(e) => Err(Error::from_reason(e)),
    }
}

#[napi]
pub fn validate_qr(input: Buffer) -> Result<DecodeResult> {
    match decode_qr_from_image(&input) {
        Ok(result) => Ok(result),
        Err(e) => Err(Error::from_reason(e)),
    }
}