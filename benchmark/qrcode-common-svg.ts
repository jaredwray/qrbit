import QRCode from "qrcode";
import { Bench } from "tinybench";
import {faker} from "@faker-js/faker";
import { tinybenchPrinter } from "@monstermann/tinybench-pretty-printer";
import pkg from "../package.json";
import { QrBit } from "../src/qrbit.js";
import { cleanVersion } from "./utils.js";
import {QRCodeCanvas} from '@loskir/styled-qr-code-node';

const bench = new Bench({ name: "QR Codes SVG with Caching", iterations: 100 });

const qrbitVersion = cleanVersion(pkg.version);
const qrcodeVersion = cleanVersion(pkg.dependencies.qrcode);
const styledQrCodeNodeVersion = cleanVersion(pkg.devDependencies["@loskir/styled-qr-code-node"]);

const qr = new QrBit({ text: faker.internet.url() });

// generate 10000 urls with faker
const urls = Array.from({ length: 10000 }, () => faker.internet.url());

bench.add(`QrBit toSvg (Native) (v${qrbitVersion})`, async () => {
	qr.text = urls[Math.floor(Math.random() * urls.length)];
	await qr.toSvg();
	await qr.toSvg();
});

bench.add(`QrBit toSvg (Rust) (v${qrbitVersion})`, async () => {
	qr.text = urls[Math.floor(Math.random() * urls.length)];
	await qr.toSvgNapi();
});

bench.add(`QRCode toString (v${qrcodeVersion})`, async () => {
	const text = urls[Math.floor(Math.random() * urls.length)];
	await QRCode.toString(text, { type: "svg" });
});

bench.add(`styled-qr-code-node toBuffer (v${styledQrCodeNodeVersion})`, async () => {
	const text = urls[Math.floor(Math.random() * urls.length)];
	const qr = new QRCodeCanvas({
		data: text,
	});
	await qr.toBuffer("svg");
});

await bench.run();

const cli = tinybenchPrinter.toMarkdown(bench);
console.log("");
console.log(`## ${bench.name}`);
console.log(cli);
console.log("");