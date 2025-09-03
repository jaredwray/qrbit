import QRCode from "qrcode";
import { Bench } from "tinybench";
import {faker} from "@faker-js/faker";
import { tinybenchPrinter } from "@monstermann/tinybench-pretty-printer";
import pkg from "../package.json";
import { QrBit } from "../src/qrbit.js";
import { cleanVersion } from "./utils.js";
import {QRCodeCanvas} from '@loskir/styled-qr-code-node';

const bench = new Bench({ name: "QR Codes PNG", iterations: 100 });

const qrbitVersion = cleanVersion(pkg.version);
const qrcodeVersion = cleanVersion(pkg.dependencies.qrcode);
const styledQrCodeNodeVersion = cleanVersion(pkg.devDependencies["@loskir/styled-qr-code-node"]);

const qr = new QrBit({ text: faker.internet.url() });

bench.add(`QrBit toPng (v${qrbitVersion})`, async () => {
	qr.text = faker.internet.url();
	await qr.toPng();
});
 
bench.add(`QRCode toBuffer (v${qrcodeVersion})`, async () => {
	const text = faker.internet.url();
	await QRCode.toBuffer(text, { type: "png" });
});

bench.add(`styled-qr-code-node toBuffer (v${styledQrCodeNodeVersion})`, async () => {
	const text = faker.internet.url();
	const qr = new QRCodeCanvas({
		data: text,
	});
	await qr.toBuffer("png");
});

await bench.run();

const cli = tinybenchPrinter.toMarkdown(bench);
console.log(cli);
console.log("");