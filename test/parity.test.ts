import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import { type ECLevel, QrBit } from "../src/qrbit";

// These tests assert that the native Rust QR engine produces SVG output that is
// byte-for-byte identical to the legacy `qrcode` (node-qrcode) package, which it
// replaced. `qrcode` is kept as a devDependency purely as this parity oracle and
// for benchmarks.

const inputs: string[] = [
	// byte / urls / names
	"https://github.com/soldair/node-qrcode",
	"https://example.com/path?q=1&x=2",
	"Jared Wray",
	"héllo wörld café",
	"日本語のテキスト",
	"emoji 😀🎉 test",
	"Здравствуйте",
	// pure numeric (exercises numeric mode + capacity boundaries)
	"0",
	"42",
	"2341383831344993",
	"12345678901234567890",
	"9".repeat(120),
	// pure alphanumeric (uppercase + symbols)
	"HELLO WORLD",
	"TEL:+1-800-555-0100",
	"ABCDEFG 1234567 $%*+-./:",
	// mixed content (exercises the dijkstra segment optimizer)
	"HELLO123world:/?#",
	"Order #12345 — TOTAL: $99.99",
	"100% PURE",
	// larger byte payload (forces higher version / multi-block)
	"The quick brown fox jumps over the lazy dog. ".repeat(8),
];

const ecLevels: ECLevel[] = ["L", "M", "Q", "H"];

function reference(
	text: string,
	width: number,
	ec: "L" | "M" | "Q" | "H",
	dark: string,
	light: string,
): Promise<string> {
	return QRCode.toString(text, {
		type: "svg",
		width,
		errorCorrectionLevel: ec,
		color: { dark, light },
	});
}

describe("node-qrcode SVG parity", () => {
	it("matches node-qrcode across inputs and error-correction levels", async () => {
		for (const text of inputs) {
			for (const ec of ecLevels) {
				const qr = new QrBit({ text, errorCorrection: ec, cache: false });
				const mine = await qr.toSvg();
				const theirs = await reference(
					text,
					200,
					ec as "L" | "M" | "Q" | "H",
					"#000000",
					"#FFFFFF",
				);
				expect(mine, `text=${text} ec=${ec}`).toEqual(theirs);
			}
		}
	});

	it("matches node-qrcode across sizes and custom colors", async () => {
		const variants = [
			{ size: 21, dark: "#000000", light: "#FFFFFF" },
			{ size: 120, dark: "#ff0000", light: "#00ff00" },
			{ size: 512, dark: "#123456", light: "#abcdef" },
		];
		for (const text of inputs.slice(0, 8)) {
			for (const v of variants) {
				const qr = new QrBit({
					text,
					size: v.size,
					backgroundColor: v.light,
					foregroundColor: v.dark,
					cache: false,
				});
				const mine = await qr.toSvg();
				const theirs = await reference(text, v.size, "H", v.dark, v.light);
				expect(mine, `text=${text} size=${v.size}`).toEqual(theirs);
			}
		}
	});

	it("accepts full error-correction names identically to initials", async () => {
		const text = "https://qrbit.dev";
		const pairs: Array<[ECLevel, "L" | "M" | "Q" | "H"]> = [
			["Low", "L"],
			["Medium", "M"],
			["Quartile", "Q"],
			["High", "H"],
		];
		for (const [full, initial] of pairs) {
			const qr = new QrBit({ text, errorCorrection: full, cache: false });
			const mine = await qr.toSvg();
			const theirs = await reference(text, 200, initial, "#000000", "#FFFFFF");
			expect(mine, `ec=${full}`).toEqual(theirs);
		}
	});
});
