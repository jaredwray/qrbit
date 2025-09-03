import QRCode from "qrcode";
import { Bench } from "tinybench";
import { tinybenchPrinter } from "@monstermann/tinybench-pretty-printer";
import pkg from "../package.json";
import { QrBit, generatePng, generateSvg } from "../src/qrbit";
import { cleanVersion } from "./utils";

const bench = new Bench({ name: "QrBit vs QRCode", time: 100 });

const testString = "https://github.com/jaredwray/qrbit";
const qrbitVersion = cleanVersion(pkg.version);
const qrcodeVersion = cleanVersion(pkg.devDependencies.qrcode);

bench.add(`QrBit PNG (v${qrbitVersion})`, () => {
	const qr = new QrBit({ text: testString });
	qr.generatePng();
});

bench.add(`QrBit SVG (v${qrbitVersion})`, () => {
	const qr = new QrBit({ text: testString });
	qr.generateSvg();
});

bench.add(`QrBit convenience PNG (v${qrbitVersion})`, () => {
	generatePng(testString);
});

bench.add(`QrBit convenience SVG (v${qrbitVersion})`, () => {
	generateSvg(testString);
});

bench.add(`QRCode PNG (v${qrcodeVersion})`, async () => {
	await QRCode.toBuffer(testString, { type: "png" });
});

bench.add(`QRCode SVG (v${qrcodeVersion})`, async () => {
	await QRCode.toString(testString, { type: "svg" });
});

await bench.run();

const cli = tinybenchPrinter.toMarkdown(bench);
console.log(cli);
console.log("");