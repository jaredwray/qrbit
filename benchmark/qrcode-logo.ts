import { Bench } from "tinybench";
import { tinybenchPrinter } from "@monstermann/tinybench-pretty-printer";
import pkg from "../package.json";
import { QrBit } from "../src/qrbit.js";
import { cleanVersion } from "./utils.js";
import {QRCodeCanvas} from '@loskir/styled-qr-code-node';

const bench = new Bench({ name: "QR Codes with Embedded Logos", iterations: 100 });

const testString = "https://github.com/jaredwray/qrbit";
const qrbitVersion = cleanVersion(pkg.version);
const styledQrCodeNodeVersion = cleanVersion(pkg.devDependencies["@loskir/styled-qr-code-node"]);

bench.add(`QrBit PNG (v${qrbitVersion})`, () => {
	const qr = new QrBit({ text: testString, logoPath: "test/fixtures/test_logo.png" });
	qr.generatePng();
});

bench.add(`QrBit SVG (v${qrbitVersion})`, () => {
	const qr = new QrBit({ text: testString, logoPath: "test/fixtures/test_logo.png" });
	qr.generateSvg();
});

bench.add(`styled-qr-code-node PNG (v${styledQrCodeNodeVersion})`, async () => {
	const qr = new QRCodeCanvas({
		data: testString,
		image: "test/fixtures/test_logo.png",
	});
	await qr.toBuffer("png");
});

bench.add(`styled-qr-code-node SVG (v${styledQrCodeNodeVersion})`, async () => {
	const qr = new QRCodeCanvas({
		data: testString,
		image: "test/fixtures/test_logo.png",
	});
	await qr.toBuffer("svg");
});

await bench.run();

const cli = tinybenchPrinter.toMarkdown(bench);
console.log(cli);
console.log("");