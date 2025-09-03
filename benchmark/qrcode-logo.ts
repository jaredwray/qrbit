import { Bench } from "tinybench";
import { tinybenchPrinter } from "@monstermann/tinybench-pretty-printer";
import pkg from "../package.json";
import { QrBit } from "../src/qrbit.js";
import { cleanVersion } from "./utils.js";
import {QRCodeCanvas} from '@loskir/styled-qr-code-node';
import { faker } from "@faker-js/faker/locale/zu_ZA";

const bench = new Bench({ name: "QR Codes with Embedded Logos", iterations: 100 });

const logo = "test/fixtures/test_logo_small.png";
const qrbitVersion = cleanVersion(pkg.version);
const styledQrCodeNodeVersion = cleanVersion(pkg.devDependencies["@loskir/styled-qr-code-node"]);

const qr = new QrBit({ text: faker.internet.url(), logo });

bench.add(`QrBit PNG (v${qrbitVersion})`, async () => {
	qr.text = faker.internet.url();
	await qr.toPng();
});

bench.add(`QrBit SVG (v${qrbitVersion})`, async () => {
	qr.text = faker.internet.url();
	await qr.toSvg();
});

bench.add(`styled-qr-code-node PNG (v${styledQrCodeNodeVersion})`, async () => {
	const text = faker.internet.url();
	const qr = new QRCodeCanvas({
		data: text,
		image: logo,
	});
	await qr.toBuffer("png");
});

bench.add(`styled-qr-code-node SVG (v${styledQrCodeNodeVersion})`, async () => {
	const text = faker.internet.url();
	const qr = new QRCodeCanvas({
		data: text,
		image: logo,
	});
	await qr.toBuffer("svg");
});

await bench.run();

const cli = tinybenchPrinter.toMarkdown(bench);
console.log("");
console.log(`## ${bench.name}`);
console.log(cli);
console.log("");