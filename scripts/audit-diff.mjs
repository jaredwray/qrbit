// Parametrized differential auditor: compares the Rust port (the exact napi
// function QrBit.toSvg calls) against the real node-qrcode QRCode.toString,
// byte-for-byte. Deterministic per seed so parallel runs cover disjoint inputs.
//
// Usage: node scripts/audit-diff.mjs <category> <count> <seed>
//   category: url|name|numeric|alpha|mixed|unicode|ascii|boundary|allopts
import QRCode from "qrcode";
import { generateQrCodeSvg } from "../src/native.js";

const category = process.argv[2] || "mixed";
const count = Number(process.argv[3] || 5000);
const seed = Number(process.argv[4] || 1);

// Deterministic LCG (no shared global state across parallel runs).
let s = (seed * 2654435761) >>> 0;
const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff), s / 0x7fffffff);
const ri = (n) => Math.floor(rnd() * n);
const pickArr = (a) => a[ri(a.length)];

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 $%*+-./:";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UNI = Array.from(
	"abcXYZ0123 .:/$%*+-?#日本語のテキストéèçàπΩ≈√∫µ😀🎉🚀🌌𝕊𝕢ЗдравÄÖÜß你好世界",
);
const ecLevels = ["L", "M", "Q", "H"];

function randText(cat, i) {
	switch (cat) {
		case "url": {
			const tld = pickArr(["com", "org", "io", "dev", "net"]);
			let p = "";
			const n = ri(40);
			for (let k = 0; k < n; k++) p += pickArr([...LOWER, "/", "-", "_", ".", "0", "9"]);
			return `https://${pickArr(["example", "test", "qrbit", "site"])}.${tld}/${p}?id=${ri(99999)}`;
		}
		case "name": {
			let t = "";
			const words = 1 + ri(6);
			for (let w = 0; w < words; w++) {
				if (w) t += " ";
				const L = 1 + ri(10);
				for (let k = 0; k < L; k++) t += pickArr([...LOWER]);
			}
			return t;
		}
		case "numeric": {
			const L = 1 + ri(400);
			let t = "";
			for (let k = 0; k < L; k++) t += ri(10);
			return t;
		}
		case "alpha": {
			const L = 1 + ri(300);
			let t = "";
			for (let k = 0; k < L; k++) t += ALPHA[ri(ALPHA.length)];
			return t;
		}
		case "mixed": {
			const L = 1 + ri(160);
			const pool = ALPHA + LOWER + ".:/?#&= ";
			let t = "";
			for (let k = 0; k < L; k++) t += pool[ri(pool.length)];
			return t;
		}
		case "unicode": {
			const L = 1 + ri(120);
			let t = "";
			for (let k = 0; k < L; k++) t += UNI[ri(UNI.length)];
			return t;
		}
		case "ascii": {
			const L = 1 + ri(200);
			let t = "";
			for (let k = 0; k < L; k++) t += String.fromCharCode(0x20 + ri(0x5f)); // printable ASCII
			return t;
		}
		default:
			return `fallback-${i}`;
	}
}

let total = 0;
let mismatches = 0;
const examples = [];

async function check(text, opts) {
	total++;
	let theirs;
	try {
		theirs = await QRCode.toString(text, { type: "svg", ...opts });
	} catch (e) {
		try {
			generateQrCodeSvg(toNapi(text, opts));
			mismatches++;
			if (examples.length < 12) examples.push({ text: prev(text), note: "theirs threw only", err: e.message });
		} catch (_) {}
		return;
	}
	let mine;
	try {
		mine = generateQrCodeSvg(toNapi(text, opts));
	} catch (e) {
		mismatches++;
		if (examples.length < 12) examples.push({ text: prev(text), note: "ours threw", err: e.message });
		return;
	}
	if (mine !== theirs) {
		mismatches++;
		if (examples.length < 12) {
			const d = firstDiff(mine, theirs);
			examples.push({ text: prev(text), opts, diffAt: d, mine: mine.slice(Math.max(0, d - 10), d + 50), theirs: theirs.slice(Math.max(0, d - 10), d + 50) });
		}
	}
}

function toNapi(text, o) {
	return { text, width: o.width, margin: o.margin, errorCorrection: o.errorCorrectionLevel, darkColor: o.color?.dark, lightColor: o.color?.light };
}
function prev(t) {
	return t.length > 50 ? `${JSON.stringify(t.slice(0, 50))}…(${t.length})` : JSON.stringify(t);
}
function firstDiff(a, b) {
	const n = Math.min(a.length, b.length);
	for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
	return a.length === b.length ? -1 : n;
}

// QRCode.toString is async by API but resolves synchronously for svg; await each.
async function run() {
	if (category === "boundary") {
		// For every version 1..40 and EC level, exercise capacity edges for each mode.
		for (let v = 1; v <= 40; v++) {
			for (const ec of ecLevels) {
				const cap = { N: capacity(v, ec, "numeric"), A: capacity(v, ec, "alpha"), B: capacity(v, ec, "byte") };
				for (const [mode, len] of [["N", cap.N], ["A", cap.A], ["B", cap.B]]) {
					for (const d of [-1, 0, 1]) {
						const L = len + d;
						if (L < 1) continue;
						const text = makeMode(mode, L);
						await check(text, { width: 200, errorCorrectionLevel: ec, color: { dark: "#000000", light: "#FFFFFF" } });
					}
				}
			}
		}
	} else if (category === "allopts") {
		const texts = ["https://github.com/soldair/node-qrcode", "12345678901234567890", "HELLO WORLD 42", "日本語 test 123", "Order #99 $5.00"];
		const colors = [undefined, { dark: "#000000", light: "#FFFFFF" }, { dark: "#ff0000", light: "#00ff00" }, { dark: "#123", light: "#abc" }, { dark: "#11223344", light: "#FFFFFF80" }, { dark: "#000000", light: "#00000000" }];
		const widths = [undefined, 19, 21, 100, 200, 512];
		const margins = [undefined, 0, 1, 4, 10, -3];
		for (const text of texts)
			for (const ec of ecLevels)
				for (const color of colors)
					for (const width of widths)
						for (const margin of margins) await check(text, { errorCorrectionLevel: ec, width, margin, color });
	} else {
		for (let i = 0; i < count; i++) {
			const text = randText(category, i);
			const ec = ecLevels[ri(4)];
			await check(text, { width: 200, errorCorrectionLevel: ec, color: { dark: "#000000", light: "#FFFFFF" } });
		}
	}

	const result = { category, seed, total, mismatches, examples: examples.slice(0, 12) };
	console.log(JSON.stringify(result));
	if (mismatches) process.exit(1);
}

// Capacity helpers mirroring node-qrcode (for boundary generation only).
const CW = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346, 404, 466, 532, 581, 655, 733, 815, 901, 991, 1085, 1156, 1258, 1364, 1474, 1588, 1706, 1828, 1921, 2051, 2185, 2323, 2465, 2611, 2761, 2876, 3034, 3196, 3362, 3532, 3706];
const ECW = [7, 10, 13, 17, 10, 16, 22, 28, 15, 26, 36, 44, 20, 36, 52, 64, 26, 48, 72, 88, 36, 64, 96, 112, 40, 72, 108, 130, 48, 88, 132, 156, 60, 110, 160, 192, 72, 130, 192, 224, 80, 150, 224, 264, 96, 176, 260, 308, 104, 198, 288, 352, 120, 216, 320, 384, 132, 240, 360, 432, 144, 280, 408, 480, 168, 308, 448, 532, 180, 338, 504, 588, 196, 364, 546, 650, 224, 416, 600, 700, 224, 442, 644, 750, 252, 476, 690, 816, 270, 504, 750, 900, 300, 560, 810, 960, 312, 588, 870, 1050, 336, 644, 952, 1110, 360, 700, 1020, 1200, 390, 728, 1050, 1260, 420, 784, 1140, 1350, 450, 812, 1200, 1440, 480, 868, 1290, 1530, 510, 924, 1350, 1620, 540, 980, 1440, 1710, 570, 1036, 1530, 1800, 570, 1064, 1590, 1890, 600, 1120, 1680, 1980, 630, 1204, 1770, 2100, 660, 1260, 1860, 2220, 720, 1316, 1950, 2310, 750, 1372, 2040, 2430];
const ecIdx = { L: 0, M: 1, Q: 2, H: 3 };
function ccBits(mode, v) {
	const i = v < 10 ? 0 : v < 27 ? 1 : 2;
	return { numeric: [10, 12, 14], alpha: [9, 11, 13], byte: [8, 16, 16] }[mode][i];
}
function capacity(v, ec, mode) {
	const usable = (CW[v] - ECW[(v - 1) * 4 + ecIdx[ec]]) * 8 - (ccBits(mode, v) + 4);
	if (mode === "numeric") return Math.floor((usable / 10) * 3);
	if (mode === "alpha") return Math.floor((usable / 11) * 2);
	return Math.floor(usable / 8);
}
function makeMode(mode, L) {
	let t = "";
	for (let k = 0; k < L; k++) t += mode === "N" ? k % 10 : mode === "A" ? ALPHA[k % ALPHA.length] : LOWER[k % LOWER.length];
	return t;
}

run();
