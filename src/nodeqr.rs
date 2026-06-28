//! A faithful port of the `node-qrcode` (soldair/node-qrcode) 1.5.4 QR encoder
//! and SVG renderer.
//!
//! The goal of this module is **byte-for-byte identical** output to
//! `QRCode.toString(text, { type: 'svg', ... })`, so that the JavaScript
//! `qrcode` dependency can be removed while keeping the rendered SVG stable.
//!
//! The structure intentionally mirrors the original JavaScript files
//! (`lib/core/*` and `lib/renderer/svg-tag.js`) so the two can be diffed.
//!
//! Kanji mode is intentionally unsupported: `node-qrcode` only enables Kanji
//! when a `toSJISFunc` is supplied, which `qrbit` never does. Kanji characters
//! therefore fall through to Byte mode exactly as they do in the JS library.

use std::collections::HashMap;
use std::sync::OnceLock;

// ---------------------------------------------------------------------------
// error-correction-level.js
// ---------------------------------------------------------------------------

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum EcLevel {
    L,
    M,
    Q,
    H,
}

impl EcLevel {
    /// `.bit` value used when building format information.
    fn bit(self) -> u32 {
        match self {
            EcLevel::L => 1,
            EcLevel::M => 0,
            EcLevel::Q => 3,
            EcLevel::H => 2,
        }
    }

    /// Index into the EC tables (L, M, Q, H order).
    fn table_index(self) -> usize {
        match self {
            EcLevel::L => 0,
            EcLevel::M => 1,
            EcLevel::Q => 2,
            EcLevel::H => 3,
        }
    }

    /// Mirrors `ECLevel.from(value, ECLevel.M)`.
    pub fn from_str_or_m(value: Option<&str>) -> EcLevel {
        match value {
            None => EcLevel::M,
            Some(s) => match s.to_lowercase().as_str() {
                "l" | "low" => EcLevel::L,
                "m" | "medium" => EcLevel::M,
                "q" | "quartile" => EcLevel::Q,
                "h" | "high" => EcLevel::H,
                _ => EcLevel::M,
            },
        }
    }
}

// ---------------------------------------------------------------------------
// mode.js (Kanji omitted — falls back to Byte just like the JS default)
// ---------------------------------------------------------------------------

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Mode {
    Numeric,
    Alphanumeric,
    Byte,
}

impl Mode {
    /// 4-bit mode indicator.
    fn bit(self) -> u32 {
        match self {
            Mode::Numeric => 1 << 0,
            Mode::Alphanumeric => 1 << 1,
            Mode::Byte => 1 << 2,
        }
    }

    /// `Mode.getCharCountIndicator(mode, version)`.
    fn cc_bits(self, version: usize) -> usize {
        let idx = if (1..10).contains(&version) {
            0
        } else if version < 27 {
            1
        } else {
            2
        };
        match self {
            Mode::Numeric => [10, 12, 14][idx],
            Mode::Alphanumeric => [9, 11, 13][idx],
            Mode::Byte => [8, 16, 16][idx],
        }
    }
}

// ---------------------------------------------------------------------------
// utils.js
// ---------------------------------------------------------------------------

const CODEWORDS_COUNT: [usize; 41] = [
    0, // not used
    26, 44, 70, 100, 134, 172, 196, 242, 292, 346, 404, 466, 532, 581, 655, 733, 815, 901, 991,
    1085, 1156, 1258, 1364, 1474, 1588, 1706, 1828, 1921, 2051, 2185, 2323, 2465, 2611, 2761, 2876,
    3034, 3196, 3362, 3532, 3706,
];

fn get_symbol_size(version: usize) -> usize {
    version * 4 + 17
}

fn get_symbol_total_codewords(version: usize) -> usize {
    CODEWORDS_COUNT[version]
}

fn get_bch_digit(mut data: u32) -> i32 {
    let mut digit = 0;
    while data != 0 {
        digit += 1;
        data >>= 1;
    }
    digit
}

// ---------------------------------------------------------------------------
// error-correction-code.js
// ---------------------------------------------------------------------------

#[rustfmt::skip]
const EC_BLOCKS_TABLE: [usize; 160] = [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 1, 2, 2, 4, 1, 2, 4, 4, 2, 4, 4, 4, 2, 4, 6, 5, 2, 4, 6, 6,
    2, 5, 8, 8, 4, 5, 8, 8, 4, 5, 8, 11, 4, 8, 10, 11, 4, 9, 12, 16, 4, 9, 16, 16, 6, 10, 12, 18, 6,
    10, 17, 16, 6, 11, 16, 19, 6, 13, 18, 21, 7, 14, 21, 25, 8, 16, 20, 25, 8, 17, 23, 25, 9, 17,
    23, 34, 9, 18, 25, 30, 10, 20, 27, 32, 12, 21, 29, 35, 12, 23, 34, 37, 12, 25, 34, 40, 13, 26,
    35, 42, 14, 28, 38, 45, 15, 29, 40, 48, 16, 31, 43, 51, 17, 33, 45, 54, 18, 35, 48, 57, 19, 37,
    51, 60, 19, 38, 53, 63, 20, 40, 56, 66, 21, 43, 59, 70, 22, 45, 62, 74, 24, 47, 65, 77, 25, 49,
    68, 81,
];

#[rustfmt::skip]
const EC_CODEWORDS_TABLE: [usize; 160] = [
    7, 10, 13, 17, 10, 16, 22, 28, 15, 26, 36, 44, 20, 36, 52, 64, 26, 48, 72, 88, 36, 64, 96, 112,
    40, 72, 108, 130, 48, 88, 132, 156, 60, 110, 160, 192, 72, 130, 192, 224, 80, 150, 224, 264, 96,
    176, 260, 308, 104, 198, 288, 352, 120, 216, 320, 384, 132, 240, 360, 432, 144, 280, 408, 480,
    168, 308, 448, 532, 180, 338, 504, 588, 196, 364, 546, 650, 224, 416, 600, 700, 224, 442, 644,
    750, 252, 476, 690, 816, 270, 504, 750, 900, 300, 560, 810, 960, 312, 588, 870, 1050, 336, 644,
    952, 1110, 360, 700, 1020, 1200, 390, 728, 1050, 1260, 420, 784, 1140, 1350, 450, 812, 1200,
    1440, 480, 868, 1290, 1530, 510, 924, 1350, 1620, 540, 980, 1440, 1710, 570, 1036, 1530, 1800,
    570, 1064, 1590, 1890, 600, 1120, 1680, 1980, 630, 1204, 1770, 2100, 660, 1260, 1860, 2220, 720,
    1316, 1950, 2310, 750, 1372, 2040, 2430,
];

fn get_blocks_count(version: usize, ecl: EcLevel) -> usize {
    EC_BLOCKS_TABLE[(version - 1) * 4 + ecl.table_index()]
}

fn get_total_codewords_count(version: usize, ecl: EcLevel) -> usize {
    EC_CODEWORDS_TABLE[(version - 1) * 4 + ecl.table_index()]
}

// ---------------------------------------------------------------------------
// galois-field.js
// ---------------------------------------------------------------------------

struct GaloisField {
    exp: [u8; 512],
    log: [u8; 256],
}

fn gf() -> &'static GaloisField {
    static GF: OnceLock<GaloisField> = OnceLock::new();
    GF.get_or_init(|| {
        let mut exp = [0u8; 512];
        let mut log = [0u8; 256];
        let mut x: u32 = 1;
        for i in 0..255 {
            exp[i] = x as u8;
            log[x as usize] = i as u8;
            x <<= 1;
            if x & 0x100 != 0 {
                x ^= 0x11D;
            }
        }
        for i in 255..512 {
            exp[i] = exp[i - 255];
        }
        GaloisField { exp, log }
    })
}

fn gf_exp(n: usize) -> u8 {
    gf().exp[n]
}

fn gf_mul(x: u8, y: u8) -> u8 {
    if x == 0 || y == 0 {
        return 0;
    }
    let g = gf();
    g.exp[g.log[x as usize] as usize + g.log[y as usize] as usize]
}

// ---------------------------------------------------------------------------
// polynomial.js
// ---------------------------------------------------------------------------

fn poly_mul(p1: &[u8], p2: &[u8]) -> Vec<u8> {
    let mut coeff = vec![0u8; p1.len() + p2.len() - 1];
    for (i, &a) in p1.iter().enumerate() {
        for (j, &b) in p2.iter().enumerate() {
            coeff[i + j] ^= gf_mul(a, b);
        }
    }
    coeff
}

fn poly_mod(divident: &[u8], divisor: &[u8]) -> Vec<u8> {
    let mut result: Vec<u8> = divident.to_vec();

    while (result.len() as isize - divisor.len() as isize) >= 0 {
        let coeff = result[0];
        for i in 0..divisor.len() {
            result[i] ^= gf_mul(divisor[i], coeff);
        }
        // remove all zeros from buffer head
        let mut offset = 0;
        while offset < result.len() && result[offset] == 0 {
            offset += 1;
        }
        result = result[offset..].to_vec();
    }

    result
}

fn generate_ec_polynomial(degree: usize) -> Vec<u8> {
    let mut poly = vec![1u8];
    for i in 0..degree {
        poly = poly_mul(&poly, &[1, gf_exp(i)]);
    }
    poly
}

// ---------------------------------------------------------------------------
// reed-solomon-encoder.js
// ---------------------------------------------------------------------------

fn rs_encode(data: &[u8], degree: usize, gen_poly: &[u8]) -> Vec<u8> {
    let mut padded = vec![0u8; data.len() + degree];
    padded[..data.len()].copy_from_slice(data);

    let remainder = poly_mod(&padded, gen_poly);

    let start = degree as isize - remainder.len() as isize;
    if start > 0 {
        let mut buff = vec![0u8; degree];
        buff[start as usize..].copy_from_slice(&remainder);
        buff
    } else {
        remainder
    }
}

// ---------------------------------------------------------------------------
// bit-buffer.js
// ---------------------------------------------------------------------------

struct BitBuffer {
    buffer: Vec<u8>,
    length: usize,
}

impl BitBuffer {
    fn new() -> Self {
        BitBuffer {
            buffer: Vec::new(),
            length: 0,
        }
    }

    fn put(&mut self, num: u32, length: usize) {
        for i in 0..length {
            self.put_bit(((num >> (length - i - 1)) & 1) == 1);
        }
    }

    fn get_length_in_bits(&self) -> usize {
        self.length
    }

    fn put_bit(&mut self, bit: bool) {
        let buf_index = self.length / 8;
        if self.buffer.len() <= buf_index {
            self.buffer.push(0);
        }
        if bit {
            self.buffer[buf_index] |= 0x80 >> (self.length % 8);
        }
        self.length += 1;
    }
}

// ---------------------------------------------------------------------------
// bit-matrix.js
// ---------------------------------------------------------------------------

pub struct BitMatrix {
    pub size: usize,
    pub data: Vec<u8>,
    reserved: Vec<u8>,
}

impl BitMatrix {
    fn new(size: usize) -> Self {
        BitMatrix {
            size,
            data: vec![0u8; size * size],
            reserved: vec![0u8; size * size],
        }
    }

    fn set(&mut self, row: usize, col: usize, value: bool, reserved: bool) {
        let index = row * self.size + col;
        self.data[index] = value as u8;
        if reserved {
            self.reserved[index] = 1;
        }
    }

    pub fn get(&self, row: usize, col: usize) -> u8 {
        self.data[row * self.size + col]
    }

    fn xor(&mut self, row: usize, col: usize, value: bool) {
        self.data[row * self.size + col] ^= value as u8;
    }

    fn is_reserved(&self, row: usize, col: usize) -> bool {
        self.reserved[row * self.size + col] != 0
    }
}

// ---------------------------------------------------------------------------
// finder-pattern.js / alignment-pattern.js
// ---------------------------------------------------------------------------

fn finder_positions(version: usize) -> [[usize; 2]; 3] {
    let size = get_symbol_size(version);
    [[0, 0], [size - 7, 0], [0, size - 7]]
}

fn alignment_row_col_coords(version: usize) -> Vec<usize> {
    if version == 1 {
        return vec![];
    }

    let pos_count = (version / 7) + 2;
    let size = get_symbol_size(version);
    let intervals = if size == 145 {
        26
    } else {
        (((size as f64 - 13.0) / (2.0 * pos_count as f64 - 2.0)).ceil() as usize) * 2
    };

    let mut positions: Vec<isize> = vec![size as isize - 7];
    for i in 1..(pos_count - 1) {
        positions.push(positions[i - 1] - intervals as isize);
    }
    positions.push(6);
    positions.reverse();
    positions.into_iter().map(|p| p as usize).collect()
}

fn alignment_positions(version: usize) -> Vec<[usize; 2]> {
    let mut coords = Vec::new();
    let pos = alignment_row_col_coords(version);
    let pos_len = pos.len();

    for i in 0..pos_len {
        for j in 0..pos_len {
            // Skip positions occupied by finder patterns.
            if (i == 0 && j == 0)
                || (i == 0 && j == pos_len - 1)
                || (i == pos_len - 1 && j == 0)
            {
                continue;
            }
            coords.push([pos[i], pos[j]]);
        }
    }

    coords
}

// ---------------------------------------------------------------------------
// version.js — version info bits
// ---------------------------------------------------------------------------

fn version_get_encoded_bits(version: u32) -> u32 {
    // G18 generator polynomial
    let g18: u32 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | 1;
    let g18_bch = get_bch_digit(g18);

    let mut d = version << 12;
    while get_bch_digit(d) - g18_bch >= 0 {
        d ^= g18 << (get_bch_digit(d) - g18_bch);
    }

    (version << 12) | d
}

// ---------------------------------------------------------------------------
// format-info.js
// ---------------------------------------------------------------------------

fn format_get_encoded_bits(ecl: EcLevel, mask: u32) -> u32 {
    let g15: u32 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | 1;
    let g15_mask: u32 = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);
    let g15_bch = get_bch_digit(g15);

    let data = (ecl.bit() << 3) | mask;
    let mut d = data << 10;

    while get_bch_digit(d) - g15_bch >= 0 {
        d ^= g15 << (get_bch_digit(d) - g15_bch);
    }

    ((data << 10) | d) ^ g15_mask
}

// ---------------------------------------------------------------------------
// Segments — character classification (regex.js equivalents)
// ---------------------------------------------------------------------------

fn is_numeric_char(c: char) -> bool {
    c.is_ascii_digit()
}

fn is_alphanumeric_char(c: char) -> bool {
    // Matches `[A-Z $%*+\-./:]` (note: digits are handled by the numeric class,
    // so the alphanumeric *segmentation* regex excludes them by design).
    matches!(c,
        'A'..='Z' | ' ' | '$' | '%' | '*' | '+' | '-' | '.' | '/' | ':')
}

#[derive(Clone, Debug)]
struct RawSegment {
    data: String,
    mode: Mode,
}

/// Mirrors `getSegmentsFromString` with Kanji disabled: the input string is
/// partitioned into maximal runs of Numeric, Alphanumeric and Byte characters.
/// Because the three character classes are disjoint and we scan left to right,
/// the produced segments are already ordered by index.
fn get_segments_from_string(data: &str) -> Vec<RawSegment> {
    #[derive(PartialEq, Clone, Copy)]
    enum Class {
        Numeric,
        Alphanumeric,
        Byte,
    }

    fn classify(c: char) -> Class {
        if is_numeric_char(c) {
            Class::Numeric
        } else if is_alphanumeric_char(c) {
            Class::Alphanumeric
        } else {
            Class::Byte
        }
    }

    let mut segments: Vec<RawSegment> = Vec::new();
    let mut current: Option<(Class, String)> = None;

    for c in data.chars() {
        let cls = classify(c);
        match &mut current {
            Some((cur_cls, buf)) if *cur_cls == cls => buf.push(c),
            _ => {
                if let Some((cls, buf)) = current.take() {
                    segments.push(RawSegment {
                        data: buf,
                        mode: match cls {
                            Class::Numeric => Mode::Numeric,
                            Class::Alphanumeric => Mode::Alphanumeric,
                            Class::Byte => Mode::Byte,
                        },
                    });
                }
                current = Some((cls, c.to_string()));
            }
        }
    }
    if let Some((cls, buf)) = current.take() {
        segments.push(RawSegment {
            data: buf,
            mode: match cls {
                Class::Numeric => Mode::Numeric,
                Class::Alphanumeric => Mode::Alphanumeric,
                Class::Byte => Mode::Byte,
            },
        });
    }

    segments
}

// ---------------------------------------------------------------------------
// Concrete segment data + bit-length helpers
// ---------------------------------------------------------------------------

fn numeric_bits_length(length: usize) -> usize {
    10 * (length / 3) + if length % 3 != 0 { (length % 3) * 3 + 1 } else { 0 }
}

fn alphanumeric_bits_length(length: usize) -> usize {
    11 * (length / 2) + 6 * (length % 2)
}

fn byte_bits_length(length: usize) -> usize {
    length * 8
}

fn segment_bits_length(length: usize, mode: Mode) -> usize {
    match mode {
        Mode::Numeric => numeric_bits_length(length),
        Mode::Alphanumeric => alphanumeric_bits_length(length),
        Mode::Byte => byte_bits_length(length),
    }
}

const ALPHA_NUM_CHARS: &[u8; 45] = b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

/// A finalized segment ready to be encoded, equivalent to the NumericData /
/// AlphanumericData / ByteData JS classes.
#[derive(Clone, Debug)]
struct Segment {
    mode: Mode,
    /// For Numeric/Alphanumeric the textual data; unused for Byte.
    text: String,
    /// For Byte mode, the UTF-8 bytes (equivalent to `TextEncoder().encode`).
    bytes: Vec<u8>,
}

impl Segment {
    fn new(mode: Mode, data: &str) -> Self {
        match mode {
            Mode::Byte => Segment {
                mode,
                text: String::new(),
                bytes: data.as_bytes().to_vec(),
            },
            _ => Segment {
                mode,
                text: data.to_string(),
                bytes: Vec::new(),
            },
        }
    }

    /// `getLength()` — char count for Numeric/Alphanumeric, byte count for Byte.
    fn get_length(&self) -> usize {
        match self.mode {
            Mode::Byte => self.bytes.len(),
            _ => self.text.chars().count(),
        }
    }

    fn get_bits_length(&self) -> usize {
        segment_bits_length(self.get_length(), self.mode)
    }

    fn write(&self, buffer: &mut BitBuffer) {
        match self.mode {
            Mode::Numeric => {
                let digits: Vec<u8> = self.text.bytes().collect();
                let mut i = 0;
                while i + 3 <= digits.len() {
                    let value: u32 = (digits[i] - b'0') as u32 * 100
                        + (digits[i + 1] - b'0') as u32 * 10
                        + (digits[i + 2] - b'0') as u32;
                    buffer.put(value, 10);
                    i += 3;
                }
                let remaining = digits.len() - i;
                if remaining > 0 {
                    let mut value: u32 = 0;
                    for d in &digits[i..] {
                        value = value * 10 + (d - b'0') as u32;
                    }
                    buffer.put(value, remaining * 3 + 1);
                }
            }
            Mode::Alphanumeric => {
                let chars: Vec<u8> = self.text.bytes().collect();
                let mut i = 0;
                while i + 2 <= chars.len() {
                    let v1 = ALPHA_NUM_CHARS.iter().position(|&c| c == chars[i]).unwrap() as u32;
                    let v2 = ALPHA_NUM_CHARS
                        .iter()
                        .position(|&c| c == chars[i + 1])
                        .unwrap() as u32;
                    buffer.put(v1 * 45 + v2, 11);
                    i += 2;
                }
                if chars.len() % 2 == 1 {
                    let v = ALPHA_NUM_CHARS.iter().position(|&c| c == chars[i]).unwrap() as u32;
                    buffer.put(v, 6);
                }
            }
            Mode::Byte => {
                for &b in &self.bytes {
                    buffer.put(b as u32, 8);
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Segments — graph node generation (segments.js)
// ---------------------------------------------------------------------------

/// UTF-8 byte length, equivalent to `getStringByteLength`.
fn get_string_byte_length(s: &str) -> usize {
    s.as_bytes().len()
}

#[derive(Clone, Debug)]
struct GNode {
    data: String,
    mode: Mode,
    length: usize,
}

fn build_nodes(segs: &[RawSegment]) -> Vec<Vec<GNode>> {
    let mut nodes = Vec::with_capacity(segs.len());
    for seg in segs {
        let char_len = seg.data.chars().count();
        match seg.mode {
            Mode::Numeric => nodes.push(vec![
                GNode { data: seg.data.clone(), mode: Mode::Numeric, length: char_len },
                GNode { data: seg.data.clone(), mode: Mode::Alphanumeric, length: char_len },
                GNode { data: seg.data.clone(), mode: Mode::Byte, length: char_len },
            ]),
            Mode::Alphanumeric => nodes.push(vec![
                GNode { data: seg.data.clone(), mode: Mode::Alphanumeric, length: char_len },
                GNode { data: seg.data.clone(), mode: Mode::Byte, length: char_len },
            ]),
            Mode::Byte => nodes.push(vec![GNode {
                data: seg.data.clone(),
                mode: Mode::Byte,
                length: get_string_byte_length(&seg.data),
            }]),
        }
    }
    nodes
}

/// Insertion-ordered adjacency used to faithfully mirror the iteration order of
/// JavaScript object keys in the dijkstra step.
struct Graph {
    /// node id -> ordered list of (neighbour id, edge cost)
    map: HashMap<String, Vec<(String, i64)>>,
    /// node id -> the underlying GNode
    table: HashMap<String, GNode>,
}

fn build_graph(nodes: &[Vec<GNode>], version: usize) -> Graph {
    let mut map: HashMap<String, Vec<(String, i64)>> = HashMap::new();
    let mut table: HashMap<String, GNode> = HashMap::new();
    let mut last_count: HashMap<String, usize> = HashMap::new();

    map.insert("start".to_string(), Vec::new());

    let mut prev_node_ids: Vec<String> = vec!["start".to_string()];

    for (i, node_group) in nodes.iter().enumerate() {
        let mut current_node_ids: Vec<String> = Vec::new();

        for (j, node) in node_group.iter().enumerate() {
            let key = format!("{}{}", i, j);

            current_node_ids.push(key.clone());
            table.insert(key.clone(), node.clone());
            last_count.insert(key.clone(), 0);
            map.entry(key.clone()).or_default();

            for prev_node_id in &prev_node_ids {
                let prev_is_table = table.contains_key(prev_node_id);
                let prev_mode = table.get(prev_node_id).map(|n| n.mode);

                let cost: i64 = if prev_is_table && prev_mode == Some(node.mode) {
                    let lc = *last_count.get(prev_node_id).unwrap();
                    let c = segment_bits_length(lc + node.length, node.mode) as i64
                        - segment_bits_length(lc, node.mode) as i64;
                    *last_count.get_mut(prev_node_id).unwrap() += node.length;
                    c
                } else {
                    if prev_is_table {
                        last_count.insert(prev_node_id.clone(), node.length);
                    }
                    segment_bits_length(node.length, node.mode) as i64
                        + 4
                        + node.mode.cc_bits(version) as i64
                };

                map.entry(prev_node_id.clone())
                    .or_default()
                    .push((key.clone(), cost));
            }
        }

        prev_node_ids = current_node_ids;
    }

    for prev_node_id in &prev_node_ids {
        map.entry(prev_node_id.clone())
            .or_default()
            .push(("end".to_string(), 0));
    }

    Graph { map, table }
}

/// Faithful port of `dijkstrajs.find_path` (naive priority queue, stable sort).
fn dijkstra_find_path(graph: &Graph, s: &str, d: &str) -> Vec<String> {
    let mut predecessors: HashMap<String, String> = HashMap::new();
    let mut costs: HashMap<String, i64> = HashMap::new();
    costs.insert(s.to_string(), 0);

    // Priority queue of (value, cost). `push` sorts by cost (stable), `pop`
    // takes the front element — matching the JS `Array.sort` + `shift`.
    let mut queue: Vec<(String, i64)> = vec![(s.to_string(), 0)];

    while !queue.is_empty() {
        // Stable sort by cost ascending; pop front.
        queue.sort_by(|a, b| a.1.cmp(&b.1));
        let (u, cost_of_s_to_u) = queue.remove(0);

        if let Some(adjacent) = graph.map.get(&u) {
            for (v, cost_of_e) in adjacent {
                let new_cost = cost_of_s_to_u + cost_of_e;
                let first_visit = !costs.contains_key(v);
                if first_visit || *costs.get(v).unwrap() > new_cost {
                    costs.insert(v.clone(), new_cost);
                    queue.push((v.clone(), new_cost));
                    predecessors.insert(v.clone(), u.clone());
                }
            }
        }
    }

    // extract_shortest_path_from_predecessor_list
    let mut path: Vec<String> = Vec::new();
    let mut u = Some(d.to_string());
    while let Some(node) = u {
        path.push(node.clone());
        u = predecessors.get(&node).cloned();
    }
    path.reverse();
    path
}

fn merge_segments(segs: Vec<GNode>) -> Vec<GNode> {
    let mut acc: Vec<GNode> = Vec::new();
    for curr in segs {
        if let Some(prev) = acc.last_mut() {
            if prev.mode == curr.mode {
                prev.data.push_str(&curr.data);
                continue;
            }
        }
        acc.push(curr);
    }
    acc
}

fn segments_from_array_gnodes(nodes: Vec<GNode>) -> Vec<Segment> {
    nodes
        .into_iter()
        .map(|n| Segment::new(n.mode, &n.data))
        .collect()
}

fn segments_from_string(data: &str, version: usize) -> Vec<Segment> {
    let segs = get_segments_from_string(data);
    let nodes = build_nodes(&segs);
    let graph = build_graph(&nodes, version);
    let path = dijkstra_find_path(&graph, "start", "end");

    let mut optimized: Vec<GNode> = Vec::new();
    if path.len() >= 2 {
        for key in &path[1..path.len() - 1] {
            optimized.push(graph.table.get(key).unwrap().clone());
        }
    }

    segments_from_array_gnodes(merge_segments(optimized))
}

fn raw_split(data: &str) -> Vec<Segment> {
    get_segments_from_string(data)
        .into_iter()
        .map(|s| Segment::new(s.mode, &s.data))
        .collect()
}

// ---------------------------------------------------------------------------
// version.js — capacity + best-version selection
// ---------------------------------------------------------------------------

fn get_reserved_bits_count(mode: Mode, version: usize) -> usize {
    mode.cc_bits(version) + 4
}

/// `getCapacity` — for Mixed mode pass `None`.
fn get_capacity(version: usize, ecl: EcLevel, mode: Option<Mode>) -> usize {
    let total_codewords = get_symbol_total_codewords(version);
    let ec_total = get_total_codewords_count(version, ecl);
    let data_total_bits = (total_codewords - ec_total) * 8;

    let mode = match mode {
        None => return data_total_bits, // Mode.MIXED
        Some(m) => m,
    };

    let usable_bits = data_total_bits - get_reserved_bits_count(mode, version);
    match mode {
        // Mirror JS `Math.floor((usableBits / 10) * 3)`: the float divide-then-
        // multiply yields a larger value than integer-divide-then-multiply.
        Mode::Numeric => ((usable_bits as f64 / 10.0) * 3.0).floor() as usize,
        Mode::Alphanumeric => ((usable_bits as f64 / 11.0) * 2.0).floor() as usize,
        Mode::Byte => usable_bits / 8,
    }
}

fn get_best_version_for_data_length(
    mode: Mode,
    length: usize,
    ecl: EcLevel,
) -> Option<usize> {
    (1..=40).find(|&v| length <= get_capacity(v, ecl, Some(mode)))
}

fn get_total_bits_from_data_array(segments: &[Segment], version: usize) -> usize {
    let mut total = 0;
    for data in segments {
        total += get_reserved_bits_count(data.mode, version) + data.get_bits_length();
    }
    total
}

fn get_best_version_for_mixed_data(segments: &[Segment], ecl: EcLevel) -> Option<usize> {
    (1..=40).find(|&v| get_total_bits_from_data_array(segments, v) <= get_capacity(v, ecl, None))
}

fn get_best_version_for_data(data: &[Segment], ecl: EcLevel) -> Option<usize> {
    if data.len() > 1 {
        return get_best_version_for_mixed_data(data, ecl);
    }
    if data.is_empty() {
        return Some(1);
    }
    let seg = &data[0];
    get_best_version_for_data_length(seg.mode, seg.get_length(), ecl)
}

// ---------------------------------------------------------------------------
// qrcode.js — matrix assembly
// ---------------------------------------------------------------------------

fn setup_finder_pattern(matrix: &mut BitMatrix, version: usize) {
    let size = matrix.size as isize;
    let pos = finder_positions(version);

    for p in &pos {
        let row = p[0] as isize;
        let col = p[1] as isize;

        for r in -1..=7isize {
            if row + r <= -1 || size <= row + r {
                continue;
            }
            for c in -1..=7isize {
                if col + c <= -1 || size <= col + c {
                    continue;
                }
                let dark = (r >= 0 && r <= 6 && (c == 0 || c == 6))
                    || (c >= 0 && c <= 6 && (r == 0 || r == 6))
                    || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
                matrix.set((row + r) as usize, (col + c) as usize, dark, true);
            }
        }
    }
}

fn setup_timing_pattern(matrix: &mut BitMatrix) {
    let size = matrix.size;
    for r in 8..(size - 8) {
        let value = r % 2 == 0;
        matrix.set(r, 6, value, true);
        matrix.set(6, r, value, true);
    }
}

fn setup_alignment_pattern(matrix: &mut BitMatrix, version: usize) {
    let pos = alignment_positions(version);
    for p in &pos {
        let row = p[0] as isize;
        let col = p[1] as isize;
        for r in -2..=2isize {
            for c in -2..=2isize {
                let dark = r == -2 || r == 2 || c == -2 || c == 2 || (r == 0 && c == 0);
                matrix.set((row + r) as usize, (col + c) as usize, dark, true);
            }
        }
    }
}

fn setup_version_info(matrix: &mut BitMatrix, version: usize) {
    let size = matrix.size;
    let bits = version_get_encoded_bits(version as u32);
    for i in 0..18usize {
        let row = i / 3;
        let col = i % 3 + size - 8 - 3;
        let mod_bit = ((bits >> i) & 1) == 1;
        matrix.set(row, col, mod_bit, true);
        matrix.set(col, row, mod_bit, true);
    }
}

fn setup_format_info(matrix: &mut BitMatrix, ecl: EcLevel, mask_pattern: u32) {
    let size = matrix.size;
    let bits = format_get_encoded_bits(ecl, mask_pattern);

    for i in 0..15usize {
        let mod_bit = ((bits >> i) & 1) == 1;

        // vertical
        if i < 6 {
            matrix.set(i, 8, mod_bit, true);
        } else if i < 8 {
            matrix.set(i + 1, 8, mod_bit, true);
        } else {
            matrix.set(size - 15 + i, 8, mod_bit, true);
        }

        // horizontal
        if i < 8 {
            matrix.set(8, size - i - 1, mod_bit, true);
        } else if i < 9 {
            matrix.set(8, 15 - i - 1 + 1, mod_bit, true);
        } else {
            matrix.set(8, 15 - i - 1, mod_bit, true);
        }
    }

    // fixed module
    matrix.set(size - 8, 8, true, true);
}

fn setup_data(matrix: &mut BitMatrix, data: &[u8]) {
    let size = matrix.size as isize;
    let mut inc: isize = -1;
    let mut row: isize = size - 1;
    let mut bit_index: isize = 7;
    let mut byte_index: usize = 0;

    let mut col: isize = size - 1;
    while col > 0 {
        if col == 6 {
            col -= 1;
        }

        loop {
            for c in 0..2isize {
                if !matrix.is_reserved(row as usize, (col - c) as usize) {
                    let mut dark = false;
                    if byte_index < data.len() {
                        dark = ((data[byte_index] >> bit_index) & 1) == 1;
                    }
                    matrix.set(row as usize, (col - c) as usize, dark, false);
                    bit_index -= 1;

                    if bit_index == -1 {
                        byte_index += 1;
                        bit_index = 7;
                    }
                }
            }

            row += inc;

            if row < 0 || size <= row {
                row -= inc;
                inc = -inc;
                break;
            }
        }

        col -= 2;
    }
}

// ---------------------------------------------------------------------------
// mask-pattern.js
// ---------------------------------------------------------------------------

fn get_mask_at(mask_pattern: u32, i: usize, j: usize) -> bool {
    match mask_pattern {
        0 => (i + j) % 2 == 0,
        1 => i % 2 == 0,
        2 => j % 3 == 0,
        3 => (i + j) % 3 == 0,
        4 => ((i / 2) + (j / 3)) % 2 == 0,
        5 => (i * j) % 2 + (i * j) % 3 == 0,
        6 => ((i * j) % 2 + (i * j) % 3) % 2 == 0,
        7 => ((i * j) % 3 + (i + j) % 2) % 2 == 0,
        _ => panic!("bad maskPattern: {}", mask_pattern),
    }
}

fn apply_mask(pattern: u32, data: &mut BitMatrix) {
    let size = data.size;
    for col in 0..size {
        for row in 0..size {
            if data.is_reserved(row, col) {
                continue;
            }
            data.xor(row, col, get_mask_at(pattern, row, col));
        }
    }
}

const N1: i64 = 3;
const N2: i64 = 3;
const N3: i64 = 40;
const N4: i64 = 10;

fn get_penalty_n1(data: &BitMatrix) -> i64 {
    let size = data.size;
    let mut points: i64 = 0;

    for row in 0..size {
        let mut same_count_col = 0i64;
        let mut same_count_row = 0i64;
        let mut last_col: i64 = -1;
        let mut last_row: i64 = -1;

        for col in 0..size {
            let mut module = data.get(row, col) as i64;
            if module == last_col {
                same_count_col += 1;
            } else {
                if same_count_col >= 5 {
                    points += N1 + (same_count_col - 5);
                }
                last_col = module;
                same_count_col = 1;
            }

            module = data.get(col, row) as i64;
            if module == last_row {
                same_count_row += 1;
            } else {
                if same_count_row >= 5 {
                    points += N1 + (same_count_row - 5);
                }
                last_row = module;
                same_count_row = 1;
            }
        }

        if same_count_col >= 5 {
            points += N1 + (same_count_col - 5);
        }
        if same_count_row >= 5 {
            points += N1 + (same_count_row - 5);
        }
    }

    points
}

fn get_penalty_n2(data: &BitMatrix) -> i64 {
    let size = data.size;
    let mut points: i64 = 0;

    for row in 0..(size - 1) {
        for col in 0..(size - 1) {
            let last = data.get(row, col) as i64
                + data.get(row, col + 1) as i64
                + data.get(row + 1, col) as i64
                + data.get(row + 1, col + 1) as i64;

            if last == 4 || last == 0 {
                points += 1;
            }
        }
    }

    points * N2
}

fn get_penalty_n3(data: &BitMatrix) -> i64 {
    let size = data.size;
    let mut points: i64 = 0;

    for row in 0..size {
        let mut bits_col = 0u32;
        let mut bits_row = 0u32;
        for col in 0..size {
            bits_col = ((bits_col << 1) & 0x7FF) | data.get(row, col) as u32;
            if col >= 10 && (bits_col == 0x5D0 || bits_col == 0x05D) {
                points += 1;
            }

            bits_row = ((bits_row << 1) & 0x7FF) | data.get(col, row) as u32;
            if col >= 10 && (bits_row == 0x5D0 || bits_row == 0x05D) {
                points += 1;
            }
        }
    }

    points * N3
}

fn get_penalty_n4(data: &BitMatrix) -> i64 {
    let mut dark_count: i64 = 0;
    let modules_count = data.data.len() as i64;
    for &b in &data.data {
        dark_count += b as i64;
    }

    // k = abs(ceil((darkCount * 100 / modulesCount) / 5) - 10)
    let ratio = (dark_count as f64) * 100.0 / (modules_count as f64);
    let k = ((ratio / 5.0).ceil() as i64 - 10).abs();

    k * N4
}

fn get_best_mask(data: &mut BitMatrix, ecl: EcLevel) -> u32 {
    let mut best_pattern = 0u32;
    let mut lower_penalty = i64::MAX;

    for p in 0..8u32 {
        setup_format_info(data, ecl, p);
        apply_mask(p, data);

        let penalty =
            get_penalty_n1(data) + get_penalty_n2(data) + get_penalty_n3(data) + get_penalty_n4(data);

        apply_mask(p, data); // undo

        if penalty < lower_penalty {
            lower_penalty = penalty;
            best_pattern = p;
        }
    }

    best_pattern
}

// ---------------------------------------------------------------------------
// qrcode.js — createData / createCodewords / createSymbol
// ---------------------------------------------------------------------------

fn create_data(version: usize, ecl: EcLevel, segments: &[Segment]) -> Vec<u8> {
    let mut buffer = BitBuffer::new();

    for data in segments {
        buffer.put(data.mode.bit(), 4);
        buffer.put(data.get_length() as u32, data.mode.cc_bits(version));
        data.write(&mut buffer);
    }

    let total_codewords = get_symbol_total_codewords(version);
    let ec_total = get_total_codewords_count(version, ecl);
    let data_total_bits = (total_codewords - ec_total) * 8;

    if buffer.get_length_in_bits() + 4 <= data_total_bits {
        buffer.put(0, 4);
    }

    while buffer.get_length_in_bits() % 8 != 0 {
        buffer.put_bit(false);
    }

    let remaining_bytes = (data_total_bits - buffer.get_length_in_bits()) / 8;
    for i in 0..remaining_bytes {
        buffer.put(if i % 2 != 0 { 0x11 } else { 0xEC }, 8);
    }

    create_codewords(&buffer, version, ecl)
}

fn create_codewords(bit_buffer: &BitBuffer, version: usize, ecl: EcLevel) -> Vec<u8> {
    let total_codewords = get_symbol_total_codewords(version);
    let ec_total = get_total_codewords_count(version, ecl);
    let data_total = total_codewords - ec_total;
    let ec_total_blocks = get_blocks_count(version, ecl);

    let blocks_in_group2 = total_codewords % ec_total_blocks;
    let blocks_in_group1 = ec_total_blocks - blocks_in_group2;

    let total_in_group1 = total_codewords / ec_total_blocks;
    let data_in_group1 = data_total / ec_total_blocks;

    let ec_count = total_in_group1 - data_in_group1;

    let gen_poly = generate_ec_polynomial(ec_count);

    let mut offset = 0usize;
    let mut dc_data: Vec<Vec<u8>> = vec![Vec::new(); ec_total_blocks];
    let mut ec_data: Vec<Vec<u8>> = vec![Vec::new(); ec_total_blocks];
    let mut max_data_size = 0usize;

    // bit_buffer.buffer is exactly `data_total` bytes long here.
    let buffer = &bit_buffer.buffer;

    for b in 0..ec_total_blocks {
        let data_size = if b < blocks_in_group1 {
            data_in_group1
        } else {
            data_in_group1 + 1
        };

        dc_data[b] = buffer[offset..offset + data_size].to_vec();
        ec_data[b] = rs_encode(&dc_data[b], ec_count, &gen_poly);

        offset += data_size;
        max_data_size = max_data_size.max(data_size);
    }

    let mut result = vec![0u8; total_codewords];
    let mut index = 0usize;

    for i in 0..max_data_size {
        for r in 0..ec_total_blocks {
            if i < dc_data[r].len() {
                result[index] = dc_data[r][i];
                index += 1;
            }
        }
    }

    for i in 0..ec_count {
        for r in 0..ec_total_blocks {
            result[index] = ec_data[r][i];
            index += 1;
        }
    }

    result
}

/// Equivalent of `QRCode.create(data, { errorCorrectionLevel })` (no explicit
/// version or mask). Returns the assembled module matrix.
pub fn create(data: &str, ecl: EcLevel) -> Result<BitMatrix, String> {
    if data.is_empty() {
        return Err("No input text".to_string());
    }

    // Estimate version from the raw (non-optimized) segments.
    let raw_segments = raw_split(data);
    let estimated_version = get_best_version_for_data(&raw_segments, ecl);

    let segments = segments_from_string(data, estimated_version.unwrap_or(40));

    let best_version = match get_best_version_for_data(&segments, ecl) {
        Some(v) => v,
        None => return Err("The amount of data is too big to be stored in a QR Code".to_string()),
    };

    let version = best_version;

    let data_bits = create_data(version, ecl, &segments);

    let module_count = get_symbol_size(version);
    let mut modules = BitMatrix::new(module_count);

    setup_finder_pattern(&mut modules, version);
    setup_timing_pattern(&mut modules);
    setup_alignment_pattern(&mut modules, version);

    // temporary format bits to reserve their positions
    setup_format_info(&mut modules, ecl, 0);

    if version >= 7 {
        setup_version_info(&mut modules, version);
    }

    setup_data(&mut modules, &data_bits);

    let mask_pattern = get_best_mask(&mut modules, ecl);

    apply_mask(mask_pattern, &mut modules);
    setup_format_info(&mut modules, ecl, mask_pattern);

    Ok(modules)
}

// ---------------------------------------------------------------------------
// renderer/utils.js — colors + options
// ---------------------------------------------------------------------------

#[derive(Clone)]
struct Color {
    hex: String,
    a: u8,
}

/// Mimics JavaScript `parseInt(str, 16)`: consumes the leading run of valid hex
/// digits and ignores the rest, returning 0 when there is no valid prefix (JS
/// yields `NaN` there, which coerces to 0 in the subsequent bitwise operations).
/// This matches node-qrcode's tolerance of malformed hex color strings.
fn js_parse_int_hex(s: &str) -> u32 {
    let mut acc: u64 = 0;
    for c in s.chars() {
        match c.to_digit(16) {
            Some(d) => acc = acc * 16 + d as u64,
            None => break,
        }
    }
    (acc & 0xFFFF_FFFF) as u32
}

/// Faithful port of `hex2rgba`.
fn hex2rgba(hex: &str) -> Result<Color, String> {
    let mut hex_code: Vec<char> = hex.replace('#', "").chars().collect();

    if hex_code.len() < 3 || hex_code.len() == 5 || hex_code.len() > 8 {
        return Err(format!("Invalid hex color: {}", hex));
    }

    // Short to long form (fff -> ffffff).
    if hex_code.len() == 3 || hex_code.len() == 4 {
        hex_code = hex_code.iter().flat_map(|c| [*c, *c]).collect();
    }

    // Default alpha.
    if hex_code.len() == 6 {
        hex_code.push('F');
        hex_code.push('F');
    }

    // node-qrcode uses `parseInt(hexCode.join(''), 16)`, which tolerates invalid
    // characters by parsing the valid prefix instead of throwing.
    let hex_string: String = hex_code.iter().collect();
    let hex_value = js_parse_int_hex(&hex_string);

    let a = (hex_value & 255) as u8;
    let hex_out: String = format!("#{}", hex_code[0..6].iter().collect::<String>());

    Ok(Color { hex: hex_out, a })
}

struct RenderOptions {
    width: Option<u32>,
    margin: i64,
    dark: Color,
    light: Color,
}

/// Faithful port of `Utils.getOptions` restricted to the fields the SVG
/// renderer consumes.
fn get_options(
    width: Option<u32>,
    margin: Option<i64>,
    dark: Option<&str>,
    light: Option<&str>,
) -> Result<RenderOptions, String> {
    let margin = match margin {
        None => 4,
        Some(m) if m < 0 => 4,
        Some(m) => m,
    };

    let width = match width {
        Some(w) if w >= 21 => Some(w),
        _ => None,
    };

    Ok(RenderOptions {
        width,
        margin,
        dark: hex2rgba(dark.unwrap_or("#000000ff"))?,
        light: hex2rgba(light.unwrap_or("#ffffffff"))?,
    })
}

// ---------------------------------------------------------------------------
// renderer/svg-tag.js
// ---------------------------------------------------------------------------

fn get_color_attrib(color: &Color, attrib: &str) -> String {
    let alpha = color.a as f64 / 255.0;
    let base = format!("{}=\"{}\"", attrib, color.hex);
    if alpha < 1.0 {
        // alpha.toFixed(2).slice(1)
        let opacity = format!("{:.2}", round_half_away(alpha * 100.0) / 100.0);
        let opacity = &opacity[1..]; // strip leading "0"
        format!("{} {}-opacity=\"{}\"", base, attrib, opacity)
    } else {
        base
    }
}

/// Reproduces JavaScript `Number.prototype.toFixed` rounding (round half away
/// from zero) for the limited precision the renderer needs.
fn round_half_away(x: f64) -> f64 {
    (x + 0.5 * x.signum()).trunc()
}

fn svg_cmd_xy(cmd: &str, x: i64, y: f64) -> String {
    // svgCmd('M', x, y) => 'M' + x + ' ' + y  (y always has a ".5" component)
    format!("{}{} {}", cmd, x, format_half(y))
}

fn svg_cmd_x(cmd: &str, x: i64) -> String {
    format!("{}{}", cmd, x)
}

/// Formats numbers of the form `<int>.5` exactly like JS string coercion does
/// (e.g. `4.5`, `12.5`). The y coordinate is always `0.5 + row + margin`.
fn format_half(y: f64) -> String {
    let whole = y.floor() as i64;
    let frac = y - whole as f64;
    if frac == 0.0 {
        format!("{}", whole)
    } else {
        // always .5 in practice
        format!("{}.5", whole)
    }
}

fn qr_to_path(data: &[u8], size: usize, margin: i64) -> String {
    let mut path = String::new();
    let mut move_by: i64 = 0;
    let mut new_row = false;
    let mut line_length: i64 = 0;

    for i in 0..data.len() {
        let col = (i % size) as i64;
        let row = (i / size) as i64;

        if col == 0 && !new_row {
            new_row = true;
        }

        if data[i] != 0 {
            line_length += 1;

            if !(i > 0 && col > 0 && data[i - 1] != 0) {
                if new_row {
                    path.push_str(&svg_cmd_xy("M", col + margin, 0.5 + row as f64 + margin as f64));
                } else {
                    path.push_str(&svg_cmd_xy("m", move_by, 0.0));
                }
                move_by = 0;
                new_row = false;
            }

            if !(col + 1 < size as i64 && data[i + 1] != 0) {
                path.push_str(&svg_cmd_x("h", line_length));
                line_length = 0;
            }
        } else {
            move_by += 1;
        }
    }

    path
}

/// Faithful port of `svg-tag.js`'s `render`. Produces the exact string that
/// `QRCode.toString(text, { type: 'svg', ... })` returns.
pub fn render_svg(
    text: &str,
    ecl: EcLevel,
    width: Option<u32>,
    margin: Option<i64>,
    dark_color: Option<&str>,
    light_color: Option<&str>,
) -> Result<String, String> {
    let opts = get_options(width, margin, dark_color, light_color)?;
    let matrix = create(text, ecl)?;

    let size = matrix.size;
    let data = &matrix.data;
    let qrcodesize = size as i64 + opts.margin * 2;

    let bg = if opts.light.a == 0 {
        String::new()
    } else {
        format!(
            "<path {} d=\"M0 0h{}v{}H0z\"/>",
            get_color_attrib(&opts.light, "fill"),
            qrcodesize,
            qrcodesize
        )
    };

    let path = format!(
        "<path {} d=\"{}\"/>",
        get_color_attrib(&opts.dark, "stroke"),
        qr_to_path(data, size, opts.margin)
    );

    let view_box = format!("viewBox=\"0 0 {} {}\"", qrcodesize, qrcodesize);

    let width_attr = match opts.width {
        None => String::new(),
        Some(w) => format!("width=\"{}\" height=\"{}\" ", w, w),
    };

    Ok(format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" {}{} shape-rendering=\"crispEdges\">{}{}</svg>\n",
        width_attr, view_box, bg, path
    ))
}
