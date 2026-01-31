import { Bench } from "tinybench";
import {faker} from "@faker-js/faker";
import { tinybenchPrinter } from "@monstermann/tinybench-pretty-printer";
import pkg from "../package.json";
import { QrBit } from "../src/qrbit.js";
import { cleanVersion } from "./utils.js";

const bench = new Bench({ name: "QR Codes WebP (No Logo)", iterations: 100 });

const qrbitVersion = cleanVersion(pkg.version);

const qr = new QrBit({ text: faker.internet.url() });

// generate 10000 urls with faker
const urls = Array.from({ length: 10000 }, () => faker.internet.url());

bench.add(`QrBit toWebp (v${qrbitVersion})`, async () => {
	qr.text = urls[Math.floor(Math.random() * urls.length)];
	await qr.toWebp();
});

bench.add(`QrBit toWebp Cached (v${qrbitVersion})`, async () => {
	qr.text = urls[Math.floor(Math.random() * urls.length)];
	await qr.toWebp();
});

// Note: styled-qr-code-node does not support WebP format

await bench.run();

const cli = tinybenchPrinter.toMarkdown(bench);
console.log("");
console.log(`## ${bench.name}`);
console.log(cli);
console.log("");
