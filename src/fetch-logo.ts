import { Buffer } from "node:buffer";

export type FetchLogoOptions = {
	/**
	 * The time limit for each request in milliseconds.
	 * @type {number}
	 * @default 5000
	 */
	timeout?: number;
	/**
	 * The largest response body to accept, in bytes. A larger response is
	 * ignored.
	 * @type {number}
	 * @default 5242880
	 */
	maxBytes?: number;
};

type Download = { url: URL; body: Buffer };

// Only the start of an HTML page is searched for icon links.
const htmlSearchLimit = 1024 * 1024;

const svgPattern =
	/^﻿?\s*(<\?xml[\s\S]*?\?>\s*)?(<!--[\s\S]*?-->\s*)*(<!doctype svg[^>]*>\s*)?<svg[\s>]/i;

/**
 * Examine the first bytes of a body and return true if it is a PNG, JPEG,
 * GIF, WebP, ICO or SVG image.
 */
function isImage(body: Buffer): boolean {
	const hex = body.subarray(0, 4).toString("hex");
	return (
		hex === "89504e47" ||
		hex.startsWith("ffd8ff") ||
		hex === "47494638" ||
		hex === "00000100" ||
		(hex === "52494646" && body.subarray(8, 12).toString("latin1") === "WEBP") ||
		svgPattern.test(body.subarray(0, 1024).toString("utf8"))
	);
}

/**
 * Find the icon links of an HTML page. The best icon comes first: SVG icons
 * and icons with `sizes="any"`, then the largest icon by `sizes`. An
 * `apple-touch-icon` without `sizes` counts as 180 pixels, and other icons
 * without `sizes` count as 16 pixels.
 */
function findIcons(html: string, base: URL): URL[] {
	const icons: Array<{ url: URL; score: number }> = [];

	for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
		const attributes = new Map<string, string>();
		for (const match of tag.matchAll(
			/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g,
		)) {
			attributes.set(
				match[1].toLowerCase(),
				match[2] ?? match[3] ?? match[4],
			);
		}

		const rel = (attributes.get("rel") ?? "").toLowerCase().split(/\s+/);
		const href = attributes.get("href");
		const touch = rel.includes("apple-touch-icon");
		if (!href || !(touch || rel.includes("icon"))) {
			continue;
		}

		let url: URL;
		try {
			url = new URL(href, base);
		} catch {
			continue;
		}

		const sizes = (attributes.get("sizes") ?? "").toLowerCase();
		const isSvg =
			(attributes.get("type") ?? "").includes("svg") ||
			url.pathname.endsWith(".svg");
		const largest = Math.max(
			0,
			...[...sizes.matchAll(/(\d+)x\d+/g)].map((size) => Number(size[1])),
		);

		let score = largest || (touch ? 180 : 16);
		if (isSvg || sizes.split(/\s+/).includes("any")) {
			score = Number.POSITIVE_INFINITY;
		}

		icons.push({ url, score });
	}

	// Array.prototype.sort is stable, so equal scores keep the page order.
	return icons.sort((a, b) => b.score - a.score).map((icon) => icon.url);
}

/**
 * Download a URL. Returns undefined if the request fails, the status is not
 * 2xx, the time limit expires, or the body is larger than `maxBytes`.
 */
async function download(
	url: URL,
	timeout: number,
	maxBytes: number,
): Promise<Download | undefined> {
	try {
		const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
		if (!response.ok) {
			await response.body?.cancel();
			return undefined;
		}

		const chunks: Buffer[] = [];
		let total = 0;
		for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
			total += chunk.length;
			if (total > maxBytes) {
				return undefined;
			}
			chunks.push(Buffer.from(chunk));
		}

		return { url: new URL(response.url), body: Buffer.concat(chunks) };
	} catch {
		return undefined;
	}
}

/**
 * Get the logo of a website, or the image at a URL.
 *
 * 1. Download the URL. If the body is an image, return it.
 * 2. Otherwise, read the icon links of the page (see `findIcons`).
 * 3. Then try `/apple-touch-icon.png` and `/favicon.ico` at the site root.
 * 4. Return the first of these that is an image.
 *
 * Only `http:` and `https:` URLs are accepted. The function does not use a
 * third-party favicon service. Do not pass a URL from an untrusted source
 * without validation, because the request goes from your server.
 * @param url - The website or image URL
 * @param options - Time and size limits
 * @returns {Promise<Buffer>} The image bytes
 * @throws {Error} If the URL is not http or https, or if no image is found
 */
export async function fetchLogo(
	url: string | URL,
	options: FetchLogoOptions = {},
): Promise<Buffer> {
	const target = new URL(url);
	if (target.protocol !== "http:" && target.protocol !== "https:") {
		throw new Error(`Only http and https URLs are supported: ${target.href}`);
	}

	const timeout = options.timeout ?? 5000;
	const maxBytes = options.maxBytes ?? 5 * 1024 * 1024;

	const page = await download(target, timeout, maxBytes);
	if (page && isImage(page.body)) {
		return page.body;
	}

	const candidates = page
		? findIcons(page.body.toString("utf8", 0, htmlSearchLimit), page.url)
		: [];
	candidates.push(
		new URL("/apple-touch-icon.png", target),
		new URL("/favicon.ico", target),
	);

	for (const candidate of candidates) {
		const icon = await download(candidate, timeout, maxBytes);
		if (icon && isImage(icon.body)) {
			return icon.body;
		}
	}

	throw new Error(`No logo found for ${target.href}`);
}
