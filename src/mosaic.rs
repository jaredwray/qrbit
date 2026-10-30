//! Mosaic QR codes: the data modules draw an image.
//!
//! This module uses the QArt method (Russ Cox, 2012). Reed-Solomon codes are
//! linear over GF(2): the XOR of two valid blocks is also a valid block. The
//! data bits after the payload terminator are free, because decoders stop at
//! the terminator. Each free bit gives one basis vector: the bit and the EC
//! bits that it changes. Gauss-Jordan elimination over these vectors finds
//! the free bits that put the wanted value in as many target modules as
//! possible. The result is a valid QR code with no errors.

use crate::nodeqr::{self, BitMatrix, BlockLayout, EcLevel};
use std::collections::BTreeMap;

/// Image samples per module, on each axis.
const SAMPLES: u32 = 4;

/// Seed for the random fill of the modules that the image does not control.
/// A fixed seed makes the output the same for the same input.
const SEED: u64 = 0x9E37_79B9_7F4A_7C15;

/// The smallest luminance difference between a dark module and the
/// background. Decoders set the threshold of an area from its pixels. In a
/// flat area, jsQR sets it to half the background luminance, so a module
/// color with more than half the luminance of the background reads as
/// light.
const CONTRAST: f32 = 0.55;

/// The largest luminance range of the module colors of one mosaic. A block
/// of pixels with two colors that differ by more than 24 levels gets a
/// threshold between the two colors in jsQR, so the lighter color reads as
/// light. The range of 0.08 is 20 levels.
const LUMINANCE_RANGE: f32 = 0.08;

pub struct MosaicOutput {
    pub matrix: BitMatrix,
    pub version: usize,
    /// Non-function modules that the image gives a value to.
    pub target_modules: u32,
    /// Target modules that have the value of the image.
    pub matched_modules: u32,
    /// The color of the image at each module that the image makes dark,
    /// in row-major order. Other modules have `None`.
    pub colors: Vec<Option<[u8; 3]>>,
    /// The most common dark color of the image, or `None` if the image has
    /// no dark area.
    pub dominant: Option<[u8; 3]>,
}

/// The source of the colors of the dark modules.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum ColorMode {
    /// The colors of the image, with the most common dark color of the
    /// image for the modules outside the image.
    Image,
    /// One fixed color for all dark modules.
    Foreground,
}

struct Target {
    row: usize,
    col: usize,
    dark: bool,
    priority: u32,
}

/// One module of the image area that the image covers.
#[derive(Clone, Copy)]
struct Cell {
    dark: bool,
    /// Average color of the covered part of the module.
    color: [u8; 3],
    /// Covered fraction of the module, from 0.5 to 1.
    coverage: f32,
}

/// The targets and colors that the image gives to the modules.
struct Sampled {
    targets: Vec<Target>,
    colors: Vec<Option<[u8; 3]>>,
    dominant: Option<[u8; 3]>,
}

/// The free-bit basis of one Reed-Solomon block. Bit `i` of a vector is
/// bit `i % 8` (most significant first) of codeword `i / 8` of the block:
/// first the data codewords, then the EC codewords.
struct Block {
    words: usize,
    base: Vec<u64>,
    vectors: Vec<u64>,
    count: usize,
    used: Vec<bool>,
    /// `(vector, bit, target)` for each controlled target.
    pivots: Vec<(usize, usize, usize)>,
}

impl Block {
    fn vector(&self, v: usize) -> &[u64] {
        &self.vectors[v * self.words..(v + 1) * self.words]
    }

    /// Make an unused vector with `bit` set the pivot for `bit`, and clear
    /// `bit` in all other vectors. Returns false if no unused vector has
    /// `bit` set.
    fn control(&mut self, bit: usize, target: usize) -> bool {
        let (w, m) = (bit / 64, 1u64 << (bit % 64));
        let words = self.words;
        let Some(pivot) =
            (0..self.count).find(|&v| !self.used[v] && self.vectors[v * words + w] & m != 0)
        else {
            return false;
        };

        self.used[pivot] = true;
        self.pivots.push((pivot, bit, target));

        let row = self.vector(pivot).to_vec();
        for v in 0..self.count {
            if v != pivot && self.vectors[v * words + w] & m != 0 {
                for (x, y) in self.vectors[v * words..(v + 1) * words]
                    .iter_mut()
                    .zip(&row)
                {
                    *x ^= y;
                }
            }
        }

        true
    }
}

fn get_bit(bits: &[u64], i: usize) -> bool {
    (bits[i / 64] >> (i % 64)) & 1 == 1
}

fn xor_into(dst: &mut [u64], src: &[u64]) {
    for (x, y) in dst.iter_mut().zip(src) {
        *x ^= y;
    }
}

/// Set the bits of `byte` (most significant first) at bit offset `offset`.
fn put_byte(bits: &mut [u64], offset: usize, byte: u8) {
    for q in 0..8 {
        if (byte >> (7 - q)) & 1 == 1 {
            let i = offset + q;
            bits[i / 64] |= 1u64 << (i % 64);
        }
    }
}

/// Small xorshift generator for the random fill.
struct Rng(u64);

impl Rng {
    fn next_bit(&mut self) -> bool {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0 >> 63 == 1
    }
}

/// EC codewords of a unit data codeword at each position of a block. Entry
/// `i` is `x^(ec_count + data_size - 1 - i) mod g(x)`, the same value that
/// `rs_encode` gives for a block with `1` at position `i` and zeros at all
/// other positions.
fn unit_responses(data_size: usize, gen_poly: &[u8]) -> Vec<Vec<u8>> {
    let ec_count = gen_poly.len() - 1;
    let mut responses = vec![Vec::new(); data_size];
    let mut r: Vec<u8> = gen_poly[1..].to_vec();

    for i in (0..data_size).rev() {
        responses[i] = r.clone();
        let top = r[0];
        r.rotate_left(1);
        r[ec_count - 1] = 0;
        if top != 0 {
            for (t, x) in r.iter_mut().enumerate() {
                *x ^= nodeqr::gf_mul(top, gen_poly[t + 1]);
            }
        }
    }

    responses
}

/// Coverage (alpha) and premultiplied red, green and blue of each sample of
/// the image, from 0 to 1, fitted into a square of `px` by `px` samples and
/// centered. Samples outside the image have zero coverage. Accepts the
/// raster formats of the `image` crate and SVG.
fn render_samples(image_bytes: &[u8], px: u32) -> Result<Vec<[f32; 4]>, String> {
    let mut samples = vec![[0.0f32; 4]; (px * px) as usize];

    if image::guess_format(image_bytes).is_ok() {
        let decoded = image::load_from_memory(image_bytes)
            .map_err(|e| format!("Failed to decode mosaic image: {}", e))?;
        let fitted = decoded
            .resize(px, px, image::imageops::FilterType::Triangle)
            .to_rgba8();
        let (dx, dy) = ((px - fitted.width()) / 2, (px - fitted.height()) / 2);
        for (x, y, p) in fitted.enumerate_pixels() {
            let [r, g, b, a] = p.0;
            let alpha = a as f32 / 255.0;
            let scale = alpha / 255.0;
            samples[((y + dy) * px + x + dx) as usize] =
                [alpha, r as f32 * scale, g as f32 * scale, b as f32 * scale];
        }
        return Ok(samples);
    }

    use resvg::{tiny_skia, usvg};
    // The image can come from an untrusted website, so it must not read
    // local files. Only images embedded as data URLs resolve.
    let options = usvg::Options {
        image_href_resolver: usvg::ImageHrefResolver {
            resolve_data: usvg::ImageHrefResolver::default_data_resolver(),
            resolve_string: Box::new(|_, _| None),
        },
        ..usvg::Options::default()
    };
    let tree = usvg::Tree::from_data(image_bytes, &options)
        .map_err(|_| "Unsupported mosaic image format".to_string())?;
    let size = tree.size();
    let scale = (px as f32 / size.width()).min(px as f32 / size.height());
    let dx = (px as f32 - size.width() * scale) / 2.0;
    let dy = (px as f32 - size.height() * scale) / 2.0;
    let mut pixmap =
        tiny_skia::Pixmap::new(px, px).ok_or_else(|| "Failed to create pixmap".to_string())?;
    resvg::render(
        &tree,
        tiny_skia::Transform::from_scale(scale, scale).post_translate(dx, dy),
        &mut pixmap.as_mut(),
    );

    // tiny-skia pixels are premultiplied already.
    for (sample, p) in samples.iter_mut().zip(pixmap.pixels()) {
        *sample = [p.alpha(), p.red(), p.green(), p.blue()].map(|c| c as f32 / 255.0);
    }
    Ok(samples)
}

/// Luminance of a color, from 0 to 1.
fn luminance(color: [u8; 3]) -> f32 {
    let [r, g, b] = color.map(|c| c as f32 / 255.0);
    0.2126 * r + 0.7152 * g + 0.0722 * b
}

/// The most common dark color of the cells, weighted by coverage. Colors
/// are grouped in bins of 8 levels per channel. The result is the average
/// color of the largest bin.
fn dominant_color(cells: &[Option<Cell>]) -> Option<[u8; 3]> {
    let mut bins: BTreeMap<[u8; 3], (f32, [f32; 3])> = BTreeMap::new();
    for cell in cells.iter().flatten().filter(|cell| cell.dark) {
        let bin = bins
            .entry(cell.color.map(|c| c >> 3))
            .or_insert((0.0, [0.0; 3]));
        bin.0 += cell.coverage;
        for (sum, &c) in bin.1.iter_mut().zip(&cell.color) {
            *sum += c as f32 * cell.coverage;
        }
    }

    // The first bin in key order wins a tie, so the result is deterministic.
    let (weight, sum) = bins
        .values()
        .fold(None, |best: Option<&(f32, [f32; 3])>, bin| {
            if best.is_none_or(|b| bin.0 > b.0) {
                Some(bin)
            } else {
                best
            }
        })?;
    Some(sum.map(|s| (s / weight).round() as u8))
}

/// Change the luminance of `color` to `target`, from 0 to 1. A darker
/// result is the color scaled towards black. A lighter result is the color
/// mixed with white. The hue does not change.
fn with_luminance(color: [u8; 3], target: f32) -> [u8; 3] {
    let lum = luminance(color);
    if target < lum && lum > 0.0 {
        let scale = target.max(0.0) / lum;
        color.map(|c| (c as f32 * scale).round() as u8)
    } else if target > lum && lum < 1.0 {
        let mix = (target.min(1.0) - lum) / (1.0 - lum);
        color.map(|c| (c as f32 + (255.0 - c as f32) * mix).round() as u8)
    } else {
        color
    }
}

/// Move `color` away from `background` until the luminance difference is at
/// least `CONTRAST`. A color on a light background becomes darker, and a
/// color on a dark background becomes lighter.
fn contrast_color(color: [u8; 3], background: [u8; 3]) -> [u8; 3] {
    let bg = luminance(background);
    let lum = luminance(color);
    let target = if bg >= 0.5 {
        lum.min(bg - CONTRAST)
    } else {
        lum.max(bg + CONTRAST)
    };
    with_luminance(color, target)
}

/// The color of each dark module of a mosaic, in row-major order. With
/// `ColorMode::Image`, each module gets the color of the image there, or
/// the dominant color of the image. The colors move away from `background`
/// so that decoders read them as dark, and their luminance range becomes at
/// most `LUMINANCE_RANGE` around the dominant color. `foreground` is the
/// color when the image has no dark area, and the color of all modules with
/// `ColorMode::Foreground`.
pub fn module_colors(
    output: &MosaicOutput,
    mode: ColorMode,
    foreground: [u8; 3],
    background: [u8; 3],
) -> Vec<[u8; 3]> {
    if mode == ColorMode::Foreground {
        return vec![foreground; output.colors.len()];
    }
    let base = output
        .dominant
        .map_or(foreground, |color| contrast_color(color, background));
    let colors: Vec<[u8; 3]> = output
        .colors
        .iter()
        .map(|color| color.map_or(base, |color| contrast_color(color, background)))
        .collect();

    let anchor = luminance(base);
    let (low, high) = colors.iter().fold((anchor, anchor), |(low, high), &color| {
        let lum = luminance(color);
        (low.min(lum), high.max(lum))
    });
    if high - low <= LUMINANCE_RANGE {
        return colors;
    }
    let scale = LUMINANCE_RANGE / (high - low);
    colors
        .into_iter()
        .map(|color| {
            let target = anchor + (luminance(color) - anchor) * scale;
            contrast_color(with_luminance(color, target), background)
        })
        .collect()
}

/// The wanted value of the modules inside the centered image area, with a
/// priority, and the colors of the image. Each module with at least half
/// coverage gets the value of the image there: dark if the whiteness (the
/// smallest RGB channel) of its average color is below `threshold`.
/// Transparent modules next to a dark module become light, so that the
/// shape stands out. Other transparent modules stay free. Edge modules
/// come first, then the modules nearer to the center.
fn sample_targets(
    image_bytes: &[u8],
    skeleton: &BitMatrix,
    size_ratio: f64,
    threshold: f64,
) -> Result<Sampled, String> {
    let size = skeleton.size;
    let area = ((size as f64 * size_ratio).round() as usize).clamp(1, size);
    let offset = (size - area) / 2;
    let px = area as u32 * SAMPLES;
    let samples = render_samples(image_bytes, px)?;

    let mut cells: Vec<Option<Cell>> = vec![None; area * area];
    for my in 0..area {
        for mx in 0..area {
            let mut sum = [0.0f32; 4];
            for sy in 0..SAMPLES {
                for sx in 0..SAMPLES {
                    let y = my as u32 * SAMPLES + sy;
                    let x = mx as u32 * SAMPLES + sx;
                    for (s, v) in sum.iter_mut().zip(&samples[(y * px + x) as usize]) {
                        *s += v;
                    }
                }
            }
            let total = (SAMPLES * SAMPLES) as f32;
            if sum[0] >= total / 2.0 {
                let rgb = [sum[1], sum[2], sum[3]].map(|c| c / sum[0]);
                let whiteness = rgb[0].min(rgb[1]).min(rgb[2]);
                cells[my * area + mx] = Some(Cell {
                    dark: (whiteness as f64) < threshold,
                    color: rgb.map(|c| (c * 255.0).round() as u8),
                    coverage: sum[0] / total,
                });
            }
        }
    }

    let dominant = dominant_color(&cells);
    let mut colors = vec![None; size * size];
    for (i, cell) in cells.iter().enumerate() {
        if let Some(Cell {
            dark: true, color, ..
        }) = cell
        {
            colors[(offset + i / area) * size + offset + i % area] = Some(*color);
        }
    }

    // Some(true) = dark, Some(false) = light, None = transparent.
    let cells: Vec<Option<bool>> = cells.iter().map(|c| c.map(|c| c.dark)).collect();
    let neighbor = |cells: &[Option<bool>], my: usize, mx: usize, oy: isize, ox: isize| {
        let (ny, nx) = (my as isize + oy, mx as isize + ox);
        if ny < 0 || nx < 0 || ny as usize >= area || nx as usize >= area {
            return None;
        }
        cells[ny as usize * area + nx as usize]
    };

    let mut wanted = cells.clone();
    for my in 0..area {
        for mx in 0..area {
            if cells[my * area + mx].is_none()
                && (-1..=1)
                    .any(|oy| (-1..=1).any(|ox| neighbor(&cells, my, mx, oy, ox) == Some(true)))
            {
                wanted[my * area + mx] = Some(false);
            }
        }
    }

    let half = area as f64 / 2.0;
    let mut targets = Vec::new();
    for my in 0..area {
        for mx in 0..area {
            let (row, col) = (offset + my, offset + mx);
            let Some(value) = wanted[my * area + mx] else {
                continue;
            };
            if skeleton.is_reserved(row, col) {
                continue;
            }

            let edge = [(0, 1), (0, -1), (1, 0), (-1, 0)]
                .iter()
                .any(|&(oy, ox)| neighbor(&wanted, my, mx, oy, ox) == Some(!value));
            let distance = (my as f64 + 0.5 - half)
                .abs()
                .max((mx as f64 + 0.5 - half).abs());
            let closeness = 1.0 - distance / half;

            targets.push(Target {
                row,
                col,
                dark: value,
                priority: edge as u32 * 2000 + (closeness * 1000.0) as u32,
            });
        }
    }

    // Stable sort, so equal priorities keep their position order.
    targets.sort_by_key(|t| std::cmp::Reverse(t.priority));
    Ok(Sampled {
        targets,
        colors,
        dominant,
    })
}

/// Generate a QR code for `text` whose data modules draw `image_bytes`.
///
/// The version is at least `min_version`. The image fills a centered square
/// of `size_ratio` times the symbol width. Image samples with a whiteness
/// below `threshold` (0 to 1) become dark modules.
pub fn create(
    text: &str,
    ecl: EcLevel,
    min_version: usize,
    image_bytes: &[u8],
    size_ratio: f64,
    threshold: f64,
) -> Result<MosaicOutput, String> {
    if !(1..=40).contains(&min_version) {
        return Err(format!("version must be from 1 to 40, got {}", min_version));
    }
    if !(size_ratio > 0.0 && size_ratio <= 1.0) {
        return Err(format!(
            "sizeRatio must be more than 0 and not more than 1, got {}",
            size_ratio
        ));
    }

    let (version, payload) = nodeqr::encode_payload_for_version(text, ecl, min_version)?;
    let skeleton = nodeqr::function_matrix(version, ecl);
    let Sampled {
        targets,
        colors,
        dominant,
    } = sample_targets(image_bytes, &skeleton, size_ratio, threshold)?;

    // Location (block, bit) of each data module, in placement order.
    let layout = BlockLayout::new(version, ecl);
    let order = layout.interleave_order();
    let positions = nodeqr::data_positions(&skeleton);
    let size = skeleton.size;
    let mut location: Vec<Option<(usize, usize)>> = vec![None; size * size];
    for (k, &(row, col)) in positions.iter().enumerate().take(order.len() * 8) {
        let (block, index) = order[k / 8];
        location[row * size + col] = Some((block, index * 8 + k % 8));
    }

    // Base codewords (payload, then zeros) and one vector per free bit.
    let gen_poly = nodeqr::generate_ec_polynomial(layout.ec_count);
    let mut blocks = Vec::with_capacity(layout.data_sizes.len());
    let mut offset = 0usize;
    for &data_size in &layout.data_sizes {
        let words = ((data_size + layout.ec_count) * 8).div_ceil(64);
        let responses = unit_responses(data_size, &gen_poly);

        let mut base = vec![0u64; words];
        let mut ec = vec![0u8; layout.ec_count];
        let mut vectors = Vec::new();
        let mut count = 0usize;
        for (i, response) in responses.iter().enumerate() {
            if offset + i < payload.len() {
                let byte = payload[offset + i];
                put_byte(&mut base, i * 8, byte);
                for (x, &r) in ec.iter_mut().zip(response) {
                    *x ^= nodeqr::gf_mul(byte, r);
                }
                continue;
            }

            for q in 0..8 {
                let unit = 0x80u8 >> q;
                let mut vector = vec![0u64; words];
                put_byte(&mut vector, i * 8, unit);
                for (t, &r) in response.iter().enumerate() {
                    put_byte(&mut vector, (data_size + t) * 8, nodeqr::gf_mul(unit, r));
                }
                vectors.extend_from_slice(&vector);
                count += 1;
            }
        }
        for (t, &byte) in ec.iter().enumerate() {
            put_byte(&mut base, (data_size + t) * 8, byte);
        }

        blocks.push(Block {
            words,
            base,
            vectors,
            count,
            used: vec![false; count],
            pivots: Vec::new(),
        });
        offset += data_size;
    }

    for (t, target) in targets.iter().enumerate() {
        if let Some((block, bit)) = location[target.row * size + target.col] {
            blocks[block].control(bit, t);
        }
    }

    // The random fill does not change controlled bits: elimination clears
    // each pivot bit in all vectors except its pivot.
    let mut rng = Rng(SEED);
    let filled: Vec<Vec<u64>> = blocks
        .iter()
        .map(|b| {
            let mut bits = b.base.clone();
            for v in 0..b.count {
                if !b.used[v] && rng.next_bit() {
                    xor_into(&mut bits, b.vector(v));
                }
            }
            bits
        })
        .collect();

    // The mask changes only which codeword value gives each module value, so
    // try all 8 masks and keep the one with the lowest penalty.
    let mut best: Option<(i64, BitMatrix)> = None;
    for mask in 0..8u32 {
        let mut codewords = filled.clone();
        for (b, block) in blocks.iter().enumerate() {
            for &(v, bit, t) in &block.pivots {
                let target = &targets[t];
                let wanted = target.dark ^ nodeqr::get_mask_at(mask, target.row, target.col);
                if get_bit(&codewords[b], bit) != wanted {
                    xor_into(&mut codewords[b], block.vector(v));
                }
            }
        }

        let mut matrix = skeleton.clone();
        for &(row, col) in &positions {
            let dark = location[row * size + col]
                .map(|(b, bit)| get_bit(&codewords[b], bit))
                .unwrap_or(false);
            matrix.set(row, col, dark, false);
        }
        nodeqr::apply_mask(mask, &mut matrix);
        nodeqr::setup_format_info(&mut matrix, ecl, mask);

        let penalty = nodeqr::get_penalty(&matrix);
        if best.as_ref().is_none_or(|(p, _)| penalty < *p) {
            best = Some((penalty, matrix));
        }
    }

    let (_, matrix) = best.expect("eight masks were tried");
    let matched = targets
        .iter()
        .filter(|t| (matrix.get(t.row, t.col) == 1) == t.dark)
        .count();

    Ok(MosaicOutput {
        matrix,
        version,
        target_modules: targets.len() as u32,
        matched_modules: matched as u32,
        colors,
        dominant,
    })
}
