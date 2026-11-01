//! SVG renderer for QArt codes.
//!
//! The coordinates of the SVG are in modules: module `(row, col)` fills the
//! square from `(col, row)` to `(col + 1, row + 1)`, and the `viewBox` adds
//! the margin. In the rounded and square styles, each horizontal run of
//! dark modules with the same color is one subpath. In the dots style, the
//! finder and alignment patterns are rings, and each other dark module is a
//! `<use>` of one shared dot. A QArt code with one color is one `<path>`. A
//! QArt code with more colors puts all shapes in one `<clipPath>` and paints
//! the colors as plain squares inside it, so that anti-aliasing leaves no
//! light line between two shapes of different colors.

use crate::nodeqr::{self, BitMatrix};
use std::collections::BTreeMap;
use std::fmt::Write as _;

/// The shape of the dark modules.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Style {
    /// Dark modules join their horizontal and vertical neighbors into shapes
    /// with round outer corners and round inner corners.
    Rounded,
    /// Each dark module is a round dot with space around it. The finder and
    /// alignment patterns are rings with a round hole and a round center.
    Dots,
    /// Each dark module is a square.
    Square,
}

impl Style {
    pub fn parse(value: &str) -> Result<Style, String> {
        match value {
            "rounded" => Ok(Style::Rounded),
            "dots" => Ok(Style::Dots),
            "square" => Ok(Style::Square),
            other => Err(format!(
                "style must be \"rounded\", \"dots\" or \"square\", got \"{}\"",
                other
            )),
        }
    }
}

/// Corner radius of the dark shapes in the rounded style, in modules.
/// Decoders sample the center of each module and the quirc decoder finds
/// the corners of the finder patterns, so a larger radius breaks the decode
/// of small images.
const CORNER_RADIUS: f64 = 0.4;
/// Diameter of a dot in the dots style, in modules. With a smaller dot,
/// jsQR reads the gaps between dots as alignment patterns, and quirc does
/// not find the center dot of the alignment patterns.
const DOT_DIAMETER: f64 = 0.9;
/// Outer corner radius of a finder pattern in the dots style, in modules.
/// The quirc decoder builds its grid from the outer corners of the finder
/// patterns, so a round outer corner breaks the decode at some sizes.
const FINDER_RADIUS: f64 = 0.0;
/// Corner radius of the hole of a finder pattern in the dots style.
const FINDER_HOLE_RADIUS: f64 = 0.5;
/// Corner radius of the 3 by 3 center of a finder pattern in the dots style.
const FINDER_CENTER_RADIUS: f64 = 0.8;
/// Outer corner radius of an alignment pattern in the dots style.
const ALIGNMENT_RADIUS: f64 = if FINDER_RADIUS < 1.0 {
    FINDER_RADIUS
} else {
    1.0
};
/// Corner radius of the hole of an alignment pattern in the dots style.
const ALIGNMENT_HOLE_RADIUS: f64 = 0.4;
/// Corner radius of the center module of an alignment pattern in the dots
/// style. The center is a full module, not a dot: jsQR finds the alignment
/// pattern as a light-dark-light run of equal lengths.
const ALIGNMENT_CENTER_RADIUS: f64 = 0.3;
/// Side of a finder pattern, in modules.
const FINDER_SIZE: usize = 7;
/// Side of an alignment pattern, in modules.
const ALIGNMENT_SIZE: usize = 5;
/// Id of the shared dot in the dots style.
const DOT_ID: &str = "qrbit-dot";

/// Format a length in modules with at most two decimals, without a leading
/// zero and without trailing zeros, for example `7`, `.5` or `-2.25`.
fn num(value: f64) -> String {
    decimals(value, 2)
}

/// Format `value` with at most `places` decimals, without a leading zero
/// and without trailing zeros.
fn decimals(value: f64, places: usize) -> String {
    let mut text = format!("{:.*}", places, value);
    if text.contains('.') {
        while text.ends_with('0') {
            text.pop();
        }
        if text.ends_with('.') {
            text.pop();
        }
    }
    if text == "-0" {
        return "0".to_string();
    }
    if let Some(rest) = text.strip_prefix("0.") {
        return format!(".{}", rest);
    }
    if let Some(rest) = text.strip_prefix("-0.") {
        return format!("-.{}", rest);
    }
    text
}

fn rgb(color: [u8; 3]) -> String {
    format!("rgb({},{},{})", color[0], color[1], color[2])
}

/// FNV-1a hash of `text`, for an id that is the same for the same content
/// and different for different QArt codes on one web page.
fn fnv1a(text: &str) -> u64 {
    text.bytes().fold(0xcbf2_9ce4_8422_2325u64, |hash, byte| {
        (hash ^ byte as u64).wrapping_mul(0x0000_0100_0000_01b3)
    })
}

/// Append a horizontal (`h`) or vertical (`v`) line, if it has a length.
fn line(d: &mut String, command: char, length: f64) {
    if length.abs() >= 0.005 {
        let _ = write!(d, "{}{}", command, num(length));
    }
}

/// Append a quarter circle of radius `r` to the point at `(dx, dy)`, if the
/// radius is not zero. `sweep` 1 turns clockwise, so it rounds the corner
/// of a rectangle that is drawn clockwise.
fn arc(d: &mut String, r: f64, sweep: u8, dx: f64, dy: f64) {
    if r > 0.0 {
        let _ = write!(
            d,
            "a{} {} 0 0 {} {} {}",
            num(r),
            num(r),
            sweep,
            num(dx),
            num(dy)
        );
    }
}

/// Append a rectangle drawn clockwise from the top edge, with the corner
/// radii `[top-left, top-right, bottom-right, bottom-left]`.
fn rounded_rect(d: &mut String, x: f64, y: f64, w: f64, h: f64, r: [f64; 4]) {
    let _ = write!(d, "M{} {}", num(x + r[0]), num(y));
    line(d, 'h', w - r[0] - r[1]);
    arc(d, r[1], 1, r[1], r[1]);
    line(d, 'v', h - r[1] - r[2]);
    arc(d, r[2], 1, -r[2], r[2]);
    line(d, 'h', -(w - r[2] - r[3]));
    arc(d, r[3], 1, -r[3], -r[3]);
    // With a sharp top-left corner, `z` draws the last line.
    if r[0] > 0.0 {
        line(d, 'v', -(h - r[3] - r[0]));
        arc(d, r[0], 1, r[0], -r[0]);
    }
    d.push('z');
}

/// Append a rectangle drawn counterclockwise with corners of radius `r`.
/// Inside a shape that is drawn clockwise, it is a hole.
fn hole(d: &mut String, x: f64, y: f64, w: f64, h: f64, r: f64) {
    let _ = write!(d, "M{} {}", num(x + r), num(y));
    arc(d, r, 0, -r, r);
    line(d, 'v', h - 2.0 * r);
    arc(d, r, 0, r, r);
    line(d, 'h', w - 2.0 * r);
    arc(d, r, 0, r, -r);
    line(d, 'v', -(h - 2.0 * r));
    arc(d, r, 0, -r, -r);
    d.push('z');
}

/// Append a rectangle without round corners.
fn rect(d: &mut String, x: f64, y: f64, w: f64, h: f64) {
    let _ = write!(
        d,
        "M{} {}h{}v{}h{}z",
        num(x),
        num(y),
        num(w),
        num(h),
        num(-w)
    );
}

/// Append the fill of an inner corner. The corner is at `(x, y)`, and the
/// light module extends from the corner in the direction `(sx, sy)`, each
/// `1` or `-1`. The fill is the square of side `r` at the corner, minus the
/// quarter circle around the far corner of that square.
fn fillet(d: &mut String, x: f64, y: f64, sx: f64, sy: f64, r: f64) {
    let sweep = if sx * sy > 0.0 { 0 } else { 1 };
    let _ = write!(
        d,
        "M{} {}h{}a{} {} 0 0 {} {} {}z",
        num(x),
        num(y),
        num(sx * r),
        num(r),
        num(r),
        sweep,
        num(-sx * r),
        num(sy * r)
    );
}

/// The shared dot of the dots style: a circle in the module square.
fn dot() -> String {
    let r = DOT_DIAMETER / 2.0;
    format!(
        "M{} .5a{r} {r} 0 1 0 {d} 0a{r} {r} 0 1 0 -{d} 0z",
        num(0.5 - r),
        r = num(r),
        d = num(DOT_DIAMETER)
    )
}

struct Renderer<'a> {
    matrix: &'a BitMatrix,
    colors: &'a [[u8; 3]],
    style: Style,
    /// True for each module that a finder or alignment pattern ring draws
    /// in the dots style, in row-major order.
    in_eye: Vec<bool>,
    /// Path data of the dark shapes, by color.
    shapes: BTreeMap<[u8; 3], String>,
    /// Path data of plain squares that cover the shapes, by color. A QArt code
    /// with more than one color paints these inside the clip of the shapes.
    squares: BTreeMap<[u8; 3], String>,
    /// Dark modules of the shapes of each color.
    counts: BTreeMap<[u8; 3], usize>,
    /// `<use>` elements of the dots, by color.
    uses: BTreeMap<[u8; 3], String>,
}

impl Renderer<'_> {
    fn size(&self) -> usize {
        self.matrix.size
    }

    fn version(&self) -> usize {
        (self.size() - 17) / 4
    }

    /// True if the module is dark. Modules outside the symbol are light.
    fn dark(&self, row: isize, col: isize) -> bool {
        let size = self.size() as isize;
        row >= 0
            && col >= 0
            && row < size
            && col < size
            && self.matrix.get(row as usize, col as usize) != 0
    }

    fn light(&self, row: isize, col: isize) -> bool {
        !self.dark(row, col)
    }

    fn color(&self, row: usize, col: usize) -> [u8; 3] {
        self.colors[row * self.size() + col]
    }

    /// The top-left module of each finder pattern.
    fn finders(&self) -> [(usize, usize); 3] {
        let far = self.size() - FINDER_SIZE;
        [(0, 0), (0, far), (far, 0)]
    }

    /// The top-left module of each alignment pattern.
    fn alignments(&self) -> Vec<(usize, usize)> {
        nodeqr::alignment_positions(self.version())
            .into_iter()
            .map(|[row, col]| (row - 2, col - 2))
            .collect()
    }

    /// The modules of the finder and alignment patterns, which the eyes draw
    /// in the dots style.
    fn eye_modules(&self) -> Vec<bool> {
        let size = self.size();
        let mut in_eye = vec![false; size * size];
        if self.style != Style::Dots {
            return in_eye;
        }
        for (top, left) in self.finders() {
            for row in top..top + FINDER_SIZE {
                for col in left..left + FINDER_SIZE {
                    in_eye[row * size + col] = true;
                }
            }
        }
        for (top, left) in self.alignments() {
            for row in top..top + ALIGNMENT_SIZE {
                for col in left..left + ALIGNMENT_SIZE {
                    in_eye[row * size + col] = true;
                }
            }
        }
        in_eye
    }

    /// True if the corner of module `(row, col)` in the direction `(dy, dx)`
    /// is an outer corner of a finder pattern. The quirc decoder builds its
    /// grid from these corners, so they stay sharp in the rounded style.
    fn finder_corner(&self, row: isize, col: isize, dy: isize, dx: isize) -> bool {
        let last = FINDER_SIZE as isize - 1;
        let corner = |start: usize, at: isize, direction: isize| {
            let start = start as isize;
            (at == start && direction < 0) || (at == start + last && direction > 0)
        };
        self.finders()
            .iter()
            .any(|&(top, left)| corner(top, row, dy) && corner(left, col, dx))
    }

    /// Append each dark module that is not part of a ring as a reference to
    /// the shared dot.
    fn dots(&mut self) {
        let size = self.size();
        for row in 0..size {
            for col in 0..size {
                if self.matrix.get(row, col) != 0 && !self.in_eye[row * size + col] {
                    let color = self.color(row, col);
                    let _ = write!(
                        self.uses.entry(color).or_default(),
                        "<use href=\"#{}\" x=\"{}\" y=\"{}\"/>",
                        DOT_ID,
                        col,
                        row
                    );
                }
            }
        }
    }

    /// Append the finder and alignment patterns as rings with a round
    /// center. Each pattern gets the color of its center module.
    fn eyes(&mut self) {
        for (top, left) in self.finders() {
            self.eye(
                top,
                left,
                FINDER_SIZE,
                FINDER_RADIUS,
                FINDER_HOLE_RADIUS,
                FINDER_CENTER_RADIUS,
            );
        }
        for (top, left) in self.alignments() {
            self.eye(
                top,
                left,
                ALIGNMENT_SIZE,
                ALIGNMENT_RADIUS,
                ALIGNMENT_HOLE_RADIUS,
                ALIGNMENT_CENTER_RADIUS,
            );
        }
    }

    /// Append a ring of `side` modules with a hole of `side - 2` modules,
    /// and a center of `side - 4` modules with the corner radius `center`.
    fn eye(
        &mut self,
        top: usize,
        left: usize,
        side: usize,
        radius: f64,
        hole_radius: f64,
        center: f64,
    ) {
        let color = self.color(top + side / 2, left + side / 2);
        let (x, y, w) = (left as f64, top as f64, side as f64);
        let d = self.shapes.entry(color).or_default();
        rounded_rect(d, x, y, w, w, [radius; 4]);
        hole(d, x + 1.0, y + 1.0, w - 2.0, w - 2.0, hole_radius);
        rounded_rect(d, x + 2.0, y + 2.0, w - 4.0, w - 4.0, [center; 4]);

        let size = self.size();
        let squares = self.squares.entry(color).or_default();
        let mut count = 0;
        for row in top..top + side {
            for col in left..left + side {
                if self.in_eye[row * size + col] && self.matrix.get(row, col) != 0 {
                    rect(squares, col as f64, row as f64, 1.0, 1.0);
                    count += 1;
                }
            }
        }
        *self.counts.entry(color).or_default() += count;
    }

    /// Append each horizontal run of dark modules with the same color as a
    /// rectangle.
    fn runs(&mut self) {
        let size = self.size();
        for row in 0..size {
            let mut col = 0;
            while col < size {
                if self.matrix.get(row, col) == 0 {
                    col += 1;
                    continue;
                }

                let color = self.color(row, col);
                let start = col;
                col += 1;
                while col < size && self.matrix.get(row, col) != 0 && self.color(row, col) == color
                {
                    col += 1;
                }
                let radii = self.radii(row, start, col - 1);
                let (x, y, w) = (start as f64, row as f64, (col - start) as f64);
                rounded_rect(self.shapes.entry(color).or_default(), x, y, w, 1.0, radii);
                rect(self.squares.entry(color).or_default(), x, y, w, 1.0);
                *self.counts.entry(color).or_default() += col - start;
            }
        }
    }

    /// The corner radii of the run from `first` to `last` in `row`. In the
    /// rounded style, a corner is round if the modules on both sides of it
    /// are light, and it is not an outer corner of a finder pattern.
    fn radii(&self, row: usize, first: usize, last: usize) -> [f64; 4] {
        if self.style == Style::Square {
            return [0.0; 4];
        }
        let (r, f, l) = (row as isize, first as isize, last as isize);
        let round = |col: isize, dy: isize, dx: isize| {
            if self.light(r + dy, col)
                && self.light(r, col + dx)
                && !self.finder_corner(r, col, dy, dx)
            {
                CORNER_RADIUS
            } else {
                0.0
            }
        };
        [
            round(f, -1, -1),
            round(l, -1, 1),
            round(l, 1, 1),
            round(f, 1, -1),
        ]
    }

    /// Append a fill at each inner corner: a corner of a light module whose
    /// two neighbors at that corner and the module between them are dark.
    fn fillets(&mut self) {
        let size = self.size();
        for row in 0..size {
            for col in 0..size {
                if self.matrix.get(row, col) != 0 {
                    continue;
                }
                let (r, c) = (row as isize, col as isize);
                for (sy, sx) in [(-1isize, -1isize), (-1, 1), (1, 1), (1, -1)] {
                    if self.dark(r + sy, c) && self.dark(r, c + sx) && self.dark(r + sy, c + sx) {
                        let color = self.color((r + sy) as usize, (c + sx) as usize);
                        let x = col as f64 + if sx > 0 { 1.0 } else { 0.0 };
                        let y = row as f64 + if sy > 0 { 1.0 } else { 0.0 };
                        let (dx, dy) = (-sx as f64, -sy as f64);
                        let d = self.shapes.entry(color).or_default();
                        fillet(d, x, y, dx, dy, CORNER_RADIUS);
                        let d = self.squares.entry(color).or_default();
                        let _ = write!(
                            d,
                            "M{} {}h{}v{}h{}z",
                            num(x),
                            num(y),
                            num(dx * CORNER_RADIUS),
                            num(dy * CORNER_RADIUS),
                            num(-dx * CORNER_RADIUS)
                        );
                    }
                }
            }
        }
    }

    /// The color with the most dark modules in the shapes. The first color
    /// in key order wins a tie.
    fn base_color(&self) -> Option<[u8; 3]> {
        let mut best: Option<([u8; 3], usize)> = None;
        for (&color, &count) in &self.counts {
            if best.is_none_or(|(_, n)| count > n) {
                best = Some((color, count));
            }
        }
        best.map(|(color, _)| color)
    }
}

/// Render `matrix` as an SVG of `size` pixels plus `margin` pixels on each
/// side. `colors` gives the color of each module in row-major order; only
/// the colors of dark modules are used.
pub fn render(
    matrix: &BitMatrix,
    colors: &[[u8; 3]],
    size: u32,
    margin: u32,
    background: [u8; 3],
    style: Style,
) -> String {
    let mut renderer = Renderer {
        matrix,
        colors,
        style,
        in_eye: Vec::new(),
        shapes: BTreeMap::new(),
        squares: BTreeMap::new(),
        counts: BTreeMap::new(),
        uses: BTreeMap::new(),
    };
    renderer.in_eye = renderer.eye_modules();
    match style {
        Style::Square => renderer.runs(),
        Style::Rounded => {
            renderer.runs();
            renderer.fillets();
        }
        Style::Dots => {
            renderer.eyes();
            renderer.dots();
        }
    }

    let total = size + 2 * margin;
    let modules = matrix.size as f64;
    let margin_modules = margin as f64 * modules / size as f64;
    let origin = decimals(-margin_modules, 4);
    let view = decimals(modules + 2.0 * margin_modules, 4);
    // Round shapes need anti-aliasing. The PNG converter uses crisp edges
    // for shapes that do not say otherwise.
    let rendering = if style == Style::Square {
        ""
    } else {
        " shape-rendering=\"geometricPrecision\""
    };

    let mut svg = format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{total}\" height=\"{total}\" viewBox=\"{origin} {origin} {view} {view}\"{rendering}><rect x=\"{origin}\" y=\"{origin}\" width=\"{view}\" height=\"{view}\" fill=\"{bg}\"/>",
        bg = rgb(background),
    );
    if style == Style::Dots {
        let _ = write!(
            svg,
            "<defs><path id=\"{}\" d=\"{}\"/></defs>",
            DOT_ID,
            dot()
        );
    }

    if renderer.shapes.len() <= 1 {
        for (color, d) in &renderer.shapes {
            let _ = write!(svg, "<path fill=\"{}\" d=\"{}\"/>", rgb(*color), d);
        }
    } else if let Some(base) = renderer.base_color() {
        let shapes: String = renderer.shapes.values().map(String::as_str).collect();
        let id = format!("qrbit-qart-{:016x}", fnv1a(&shapes));
        let _ = write!(
            svg,
            "<clipPath id=\"{id}\"><path d=\"{shapes}\"/></clipPath><g clip-path=\"url(#{id})\"><rect x=\"{origin}\" y=\"{origin}\" width=\"{view}\" height=\"{view}\" fill=\"{}\"/>",
            rgb(base)
        );
        for (color, d) in &renderer.squares {
            if *color != base {
                let _ = write!(svg, "<path fill=\"{}\" d=\"{}\"/>", rgb(*color), d);
            }
        }
        svg.push_str("</g>");
    }

    for (color, uses) in &renderer.uses {
        let _ = write!(svg, "<g fill=\"{}\">{}</g>", rgb(*color), uses);
    }
    svg.push_str("</svg>");
    svg
}
