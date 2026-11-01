import { Buffer } from "node:buffer";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

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
	/**
	 * Return true to allow a request to an IP address. qrbit calls this
	 * function for each request, redirect, icon link and fallback, with each
	 * address that the host name resolves to, and connects only to an
	 * allowed address. The default allows only public addresses, so a page
	 * cannot make your server request a private network, a loopback address
	 * or a cloud metadata service.
	 * @type {(address: string, url: URL) => boolean}
	 */
	allowAddress?: (address: string, url: URL) => boolean;
};

type Download = { url: URL; body: Buffer };

// Only the start of an HTML page is searched for icon links.
const htmlSearchLimit = 1024 * 1024;

// The largest number of redirects that one download follows.
const redirectLimit = 5;

// The most icon links of one page that fetchLogo tries, so that a page with
// many links cannot keep the caller busy for a long time.
const iconLimit = 8;

// Addresses that are not on the public internet: private, loopback,
// link-local (cloud metadata), shared, benchmark, multicast and reserved
// ranges. BlockList also applies the IPv4 ranges to IPv4-mapped IPv6
// addresses.
const blockedRanges = new net.BlockList();
for (const [network, prefix] of [
	["0.0.0.0", 8],
	["10.0.0.0", 8],
	["100.64.0.0", 10],
	["127.0.0.0", 8],
	["169.254.0.0", 16],
	["172.16.0.0", 12],
	["192.0.0.0", 24],
	["192.168.0.0", 16],
	["198.18.0.0", 15],
	["224.0.0.0", 3],
] as const) {
	blockedRanges.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
	["::", 127],
	["fc00::", 7],
	["fe80::", 10],
	["ff00::", 8],
] as const) {
	blockedRanges.addSubnet(network, prefix, "ipv6");
}

/** True if the address is on the public internet. */
function isPublicAddress(address: string): boolean {
	return !blockedRanges.check(address, net.isIPv4(address) ? "ipv4" : "ipv6");
}

/** A request to an address that `allowAddress` does not allow. */
class BlockedAddressError extends Error {
	constructor(url: URL, address: string) {
		super(
			`The address ${address} of ${url.href} is not allowed. qrbit requests only public addresses. Use the allowAddress option to allow other addresses`,
		);
	}
}

const namedReferences: Record<string, string> = {
	amp: "&",
	apos: "'",
	gt: ">",
	lt: "<",
	quot: '"',
};

/**
 * Decode the HTML character references that can occur in a URL attribute.
 * The digit limits keep each numeric reference in the Unicode range.
 */
function decodeReferences(value: string): string {
	return value.replace(
		/&(?:#x([\da-f]{1,4})|#(\d{1,5})|(amp|apos|gt|lt|quot));/gi,
		(_, hex?: string, decimal?: string, name?: string) => {
			if (hex) {
				return String.fromCodePoint(Number.parseInt(hex, 16));
			}
			if (decimal) {
				return String.fromCodePoint(Number(decimal));
			}
			return namedReferences[(name as string).toLowerCase()];
		},
	);
}

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
				decodeReferences(match[2] ?? match[3] ?? match[4]),
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
 * Send one GET request. The host name is resolved first, and each of its
 * addresses must be allowed. The request then goes to the first allowed
 * address, so a second DNS answer cannot change the destination.
 */
async function get(
	url: URL,
	signal: AbortSignal,
	allowAddress: (address: string, url: URL) => boolean,
): Promise<http.IncomingMessage> {
	const hostname = url.hostname.replace(/^\[|\]$/g, "");
	const addresses = await dns.promises.lookup(hostname, { all: true });
	for (const { address } of addresses) {
		if (!allowAddress(address, url)) {
			throw new BlockedAddressError(url, address);
		}
	}
	// IPv4 first, because many servers have no IPv6 route.
	const { address } =
		addresses.find(({ family }) => family === 4) ?? addresses[0];

	const client = url.protocol === "https:" ? https : http;
	return new Promise((resolve, reject) => {
		client
			.get(
				{
					host: address,
					port: url.port,
					path: `${url.pathname}${url.search}`,
					servername: net.isIP(hostname) ? undefined : hostname,
					headers: { host: url.host, "user-agent": "qrbit" },
					signal,
				},
				resolve,
			)
			.on("error", reject);
	});
}

/**
 * Download a URL, and follow up to `redirectLimit` redirects. Returns
 * undefined if a request fails, the status is not 2xx, a redirect goes to a
 * URL that is not http or https, the time limit expires, or the body is
 * larger than `maxBytes`. Throws `BlockedAddressError` if `allowAddress`
 * does not allow an address of the URL or of a redirect.
 */
async function download(
	url: URL,
	timeout: number,
	maxBytes: number,
	allowAddress: (address: string, url: URL) => boolean,
): Promise<Download | undefined> {
	const signal = AbortSignal.timeout(timeout);
	let current = url;
	try {
		for (let redirects = 0; redirects <= redirectLimit; redirects++) {
			if (current.protocol !== "http:" && current.protocol !== "https:") {
				return undefined;
			}

			const response = await get(current, signal, allowAddress);
			const status = response.statusCode as number;
			const location = response.headers.location;
			if (status >= 300 && status < 400 && location) {
				response.resume();
				current = new URL(location, current);
				continue;
			}
			if (status < 200 || status >= 300) {
				response.resume();
				return undefined;
			}

			const chunks: Buffer[] = [];
			let total = 0;
			for await (const chunk of response as AsyncIterable<Buffer>) {
				total += chunk.length;
				if (total > maxBytes) {
					response.destroy();
					return undefined;
				}
				chunks.push(chunk);
			}
			return { url: current, body: Buffer.concat(chunks) };
		}
		return undefined;
	} catch (error) {
		if (error instanceof BlockedAddressError) {
			throw error;
		}
		return undefined;
	}
}

/**
 * Get the logo of a website, or the image at a URL.
 *
 * 1. Download the URL. If the body is an image, return it.
 * 2. Otherwise, read the icon links of the page (see `findIcons`), and
 *    keep the best `iconLimit` links.
 * 3. Then try `/apple-touch-icon.png` and `/favicon.ico` at the site root.
 * 4. Return the first of these that is an image.
 *
 * Only `http:` and `https:` URLs are accepted. The function does not use a
 * third-party favicon service. Each request, redirect, icon link and
 * fallback goes only to addresses that `allowAddress` allows (by default,
 * public addresses). An icon link or a fallback to a blocked address is
 * skipped.
 * @param url - The website or image URL
 * @param options - Time and size limits, and the address rule
 * @returns {Promise<Buffer>} The image bytes
 * @throws {Error} If the URL is not http or https, if the page or one of
 * its redirects goes to a blocked address, or if no image is found
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
	const allowAddress = options.allowAddress ?? isPublicAddress;

	const page = await download(target, timeout, maxBytes, allowAddress);
	if (page && isImage(page.body)) {
		return page.body;
	}

	// After a redirect, the site at the final address gives the icons.
	const site = page?.url ?? target;
	const candidates = page
		? findIcons(page.body.toString("utf8", 0, htmlSearchLimit), site).slice(
				0,
				iconLimit,
			)
		: [];
	candidates.push(
		new URL("/apple-touch-icon.png", site),
		new URL("/favicon.ico", site),
	);

	for (const candidate of candidates) {
		const icon = await download(
			candidate,
			timeout,
			maxBytes,
			allowAddress,
		).catch(() => undefined);
		if (icon && isImage(icon.body)) {
			return icon.body;
		}
	}

	throw new Error(`No logo found for ${target.href}`);
}
