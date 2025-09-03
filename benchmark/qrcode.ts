import QRCode from "qrcode";
import { Bench } from "tinybench";
import {faker} from "@faker-js/faker";
import { tinybenchPrinter } from "@monstermann/tinybench-pretty-printer";
import pkg from "../package.json";
import { QrBit } from "../src/qrbit.js";
import { cleanVersion } from "./utils.js";
import {QRCodeCanvas} from '@loskir/styled-qr-code-node';

const bench = new Bench({ name: "QR Codes", iterations: 100 });

const qrbitVersion = cleanVersion(pkg.version);
const qrcodeVersion = cleanVersion(pkg.devDependencies.qrcode);
const styledQrCodeNodeVersion = cleanVersion(pkg.devDependencies["@loskir/styled-qr-code-node"]);

bench.add(`QrBit PNG (v${qrbitVersion})`, () => {
	const text = faker.internet.url();
	const qr = new QrBit({ text });
	qr.generatePng();
});

bench.add(`QrBit SVG (v${qrbitVersion})`, () => {
	const text = faker.internet.url();
	const qr = new QrBit({ text });
	qr.generateSvg();
});

bench.add(`QRCode PNG (v${qrcodeVersion})`, async () => {
	const text = faker.internet.url();
	await QRCode.toBuffer(text, { type: "png" });
});

bench.add(`QRCode SVG (v${qrcodeVersion})`, async () => {
	const text = faker.internet.url();
	await QRCode.toString(text, { type: "svg" });
});

bench.add(`styled-qr-code-node (v${styledQrCodeNodeVersion})`, async () => {
	const text = faker.internet.url();
	const qr = new QRCodeCanvas({
		data: text,
	});
	await qr.toBuffer("png");
});

bench.add(`styled-qr-code-node SVG (v${styledQrCodeNodeVersion})`, async () => {
	const text = faker.internet.url();
	const qr = new QRCodeCanvas({
		data: text,
	});
	await qr.toBuffer("svg");
});

await bench.run();

const cli = tinybenchPrinter.toMarkdown(bench);
console.log(cli);
console.log("");