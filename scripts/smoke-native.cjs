// smoke-native.cjs: Load one native binding file and make sure that it works.
//
// CI runs this script on hosts that cannot install the npm packages, for
// example windows-11-arm. The script needs only Node.js and the `.node` file.
// It makes a QR code SVG, converts the SVG to PNG, and decodes the PNG. This
// test uses the QR encoder, resvg, and the QR decoder in the binding.
//
// Usage: node scripts/smoke-native.cjs <path-to-binding.node>

const path = require("node:path");

const file = process.argv[2];
if (!file) {
	console.error("usage: node scripts/smoke-native.cjs <path-to-binding.node>");
	process.exit(1);
}

const binding = require(path.resolve(file));
const text = "https://github.com/jaredwray/qrbit";
const svg = binding.generateQrCodeSvg({ text });
const png = binding.convertSvgToPng(svg, 256, 256);
const decoded = binding.decode(png);

if (decoded !== text) {
	console.error(
		`Smoke test failed for ${file}: decoded ${JSON.stringify(decoded)}, expected ${JSON.stringify(text)}.`,
	);
	process.exit(1);
}

console.log(
	`Smoke test passed for ${file} (${process.platform}-${process.arch}): SVG ${svg.length} chars, PNG ${png.length} bytes.`,
);
