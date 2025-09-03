import QRCode from "qrcode";
import { Bench } from "tinybench";
import { tinybenchPrinter } from "@monstermann/tinybench-pretty-printer";
import pkg from "../package.json";
import { QrBit } from "../src/qrbit.js";
import { cleanVersion } from "./utils.js";
import {QRCodeCanvas} from '@loskir/styled-qr-code-node';

const bench = new Bench({ name: "QrBit vs QRCode", iterations: 1000 });

const testString = "https://github.com/jaredwray/qrbit";
const qrbitVersion = cleanVersion(pkg.version);
const qrcodeVersion = cleanVersion(pkg.devDependencies.qrcode);
const styledQrCodeNodeVersion = cleanVersion(pkg.devDependencies["@loskir/styled-qr-code-node"]);

bench.add(`QrBit PNG (v${qrbitVersion})`, () => {
	const qr = new QrBit({ text: testString });
	qr.generatePng();
});

bench.add(`QrBit SVG (v${qrbitVersion})`, () => {
	const qr = new QrBit({ text: testString });
	qr.generateSvg();
});

bench.add(`QrBit PNG with Logo (v${qrbitVersion})`, () => {
	const qr = new QrBit({ text: testString, logoPath: "test/fixtures/test_logo.png" });
	qr.generatePng();
});

bench.add(`QRCode PNG (v${qrcodeVersion})`, async () => {
	await QRCode.toBuffer(testString, { type: "png" });
});

bench.add(`styled-qr-code-node with Logo (v${styledQrCodeNodeVersion})`, async () => {
	const qr = new QRCodeCanvas({
		data: testString,
		image: "test/fixtures/test_logo.png",
	});
	await qr.toBuffer("png");
});

// Note: qr-code-styling requires browser environment (DOM/Canvas API) and doesn't work in Node.js benchmarks

await bench.run();

const cli = tinybenchPrinter.toMarkdown(bench);
console.log(cli);
console.log("");