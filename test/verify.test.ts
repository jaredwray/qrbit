import { describe, expect, it } from "vitest";
import { buildOptions, examples } from "../scripts/examples";
import { QrBit } from "../src/qrbit";

describe("example QR codes are scannable", () => {
	it.each(examples)("$name ($format)", async (spec) => {
		const qr = new QrBit(buildOptions(spec));

		let buffer: Buffer;
		switch (spec.format) {
			case "png":
				buffer = await qr.toPng(spec.toOptions);
				break;
			case "jpg":
				buffer = await qr.toJpg(spec.toOptions);
				break;
			case "webp":
				buffer = await qr.toWebp(spec.toOptions);
				break;
			case "svg": {
				const svg = await qr.toSvg(spec.toOptions);
				buffer = QrBit.convertSvgToPng(svg);
				break;
			}
		}

		const result = await QrBit.decodeDetailed(buffer);
		expect(result.valid, `decode failed: ${result.error ?? "unknown"}`).toBe(
			true,
		);
		expect(result.data).toBe(spec.options.text);
	});
});
