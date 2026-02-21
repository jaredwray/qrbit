import { Buffer } from "node:buffer";
import fs from "node:fs";
import path from "node:path";
import { Cacheable } from "cacheable";
import { Hookified, type HookifiedOptions } from "hookified";
import QRCode, { type QRCodeToStringOptions } from "qrcode";
import {
	convertSvgToJpeg as nativeConvertSvgToJpeg,
	convertSvgToPng as nativeConvertSvgToPng,
	convertSvgToWebp as nativeConvertSvgToWebp,
	generateQrSvg as nativeGenerateQrSvg,
	generateQrSvgWithBuffer as nativeGenerateQrSvgWithBuffer,
} from "./native.js";

export enum QrBitEvents {
	warn = "warn",
	info = "info",
	error = "error",
}

export type ECLevel =
	| "L"
	| "M"
	| "Q"
	| "H"
	| "Low"
	| "Medium"
	| "Quartile"
	| "High";

const logoFileDoesNotExistMessage = (logo: string) =>
	`Logo file not found: ${logo}. Proceeding without logo.`;

export type QrOptions = {
	/**
	 * The text content to encode in the QR code. It can be text or a url.
	 * @type {string}
	 */
	text: string;
	/**
	 * The size of the QR code in pixels.
	 * @type {number}
	 * @default 200
	 */
	size?: number;
	/**
	 * The margin around the QR code in pixels.
	 * @type {number}
	 */
	margin?: number;
	/**
	 * The logo to embed in the QR code.
	 * @type {string | Buffer}
	 */
	logo?: string | Buffer;
	/**
	 * The logo size ratio relative to QR code size.
	 * @type {number}
	 * @default 0.2
	 */
	logoSizeRatio?: number;
	/**
	 * The background color of the QR code.
	 * @type {string}
	 * @default "#FFFFFF"
	 */
	backgroundColor?: string;
	/**
	 * The foreground color of the QR code.
	 * @type {string}
	 * @default "#000000"
	 */
	foregroundColor?: string;
	/**
	 * The error correction level of the QR code.
	 * Accepts initials ("L", "M", "Q", "H") or full names ("Low", "Medium", "Quartile", "High").
	 * @type {ECLevel}
	 * @default "M"
	 */
	errorCorrection?: ECLevel;
	/**
	 * Caching is enabled by default. You can disable it by setting this option to false. You can also pass
	 * a custom Cacheable instance.
	 * @type {Cacheable | boolean}
	 * @default true
	 */
	cache?: Cacheable | boolean;
} & HookifiedOptions;

export interface QrResult {
	svg?: string;
	png?: Buffer;
	width: number;
	height: number;
}

export type toOptions = {
	cache?: boolean;
	quality?: number;
};

/**
 * QR code generator with logo support and caching capabilities.
 * Supports both file path and buffer-based logos with automatic optimization.
 */
export class QrBit extends Hookified {
	private _text: string;
	private _size: number;
	private _margin: number | undefined;
	private _logo: string | Buffer | undefined;
	private _logoSizeRatio: number;
	private _backgroundColor: string;
	private _foregroundColor: string;
	private _errorCorrection: ECLevel;
	private _cache: Cacheable | undefined;
	private _napi = {
		convertSvgToJpeg: nativeConvertSvgToJpeg,
		convertSvgToPng: nativeConvertSvgToPng,
		convertSvgToWebp: nativeConvertSvgToWebp,
		generateQrSvg: nativeGenerateQrSvg,
		generateQrSvgWithBuffer: nativeGenerateQrSvgWithBuffer,
	};

	/**
	 * Create a new QrBit instance.
	 * @param options - Configuration options for the QR code
	 */
	constructor(options: QrOptions) {
		super();
		this._text = options.text;
		this._size = options.size ?? 200;
		this._margin = options.margin ?? undefined;
		this._logo = options.logo;
		this._logoSizeRatio = options.logoSizeRatio ?? 0.2;
		this._backgroundColor = options.backgroundColor ?? "#FFFFFF";
		this._foregroundColor = options.foregroundColor ?? "#000000";
		this._errorCorrection = options.errorCorrection ?? "M";
		if (options.cache !== undefined) {
			// if it is boolean and true then create a new cacheable instance
			if (options.cache === true) {
				this._cache = new Cacheable();
			} else if (options.cache !== false) {
				// it is a cacheable instance
				this._cache = options.cache as Cacheable;
			}
		} else {
			this._cache = new Cacheable();
		}

		// set throwOnEmitError to true if there are no listeners
		this.throwOnEmitError = true;
	}

	/**
	 * Get the text content for the QR code.
	 * @returns {string} The text content
	 */
	public get text(): string {
		return this._text;
	}

	/**
	 * Set the text content for the QR code.
	 * @param value - The text content to encode
	 */
	public set text(value: string) {
		this._text = value;
	}

	/**
	 * Get the size of the QR code in pixels.
	 * @returns {number} The size in pixels
	 * @default 200
	 */
	public get size(): number {
		return this._size;
	}

	/**
	 * Set the size of the QR code in pixels.
	 * @param value - The size in pixels
	 */
	public set size(value: number) {
		this._size = value;
	}

	/**
	 * Get the margin around the QR code in pixels.
	 * @returns {number | undefined} The margin in pixels
	 */
	public get margin(): number | undefined {
		return this._margin;
	}

	/**
	 * Set the margin around the QR code in pixels.
	 * @param value - The margin in pixels
	 */
	public set margin(value: number | undefined) {
		this._margin = value;
	}

	/**
	 * Get the logo path or buffer.
	 * @returns {string | Buffer | undefined} The logo path, buffer, or undefined if no logo
	 * @default undefined
	 */
	public get logo(): string | Buffer | undefined {
		return this._logo;
	}

	/**
	 * Set the logo as a file path or buffer.
	 * @param value - The logo file path, buffer, or undefined to remove logo
	 */
	public set logo(value: string | Buffer | undefined) {
		this._logo = value;
	}

	/**
	 * Get the logo size ratio relative to QR code size.
	 * @returns {number} The logo size ratio
	 * @default 0.2
	 */
	public get logoSizeRatio(): number {
		return this._logoSizeRatio;
	}

	/**
	 * Set the logo size ratio relative to QR code size.
	 * @param value - The logo size ratio (0.0 to 1.0)
	 */
	public set logoSizeRatio(value: number) {
		this._logoSizeRatio = value;
	}

	/**
	 * Get the background color of the QR code.
	 * @returns {string} The background color in hex format
	 * @default "#FFFFFF"
	 */
	public get backgroundColor(): string {
		return this._backgroundColor;
	}

	/**
	 * Set the background color of the QR code.
	 * @param value - The background color in hex format (e.g., "#FFFFFF")
	 */
	public set backgroundColor(value: string) {
		this._backgroundColor = value;
	}

	/**
	 * Get the foreground color of the QR code.
	 * @returns {string} The foreground color in hex format
	 * @default "#000000"
	 */
	public get foregroundColor(): string {
		return this._foregroundColor;
	}

	/**
	 * Set the foreground color of the QR code.
	 * @param value - The foreground color in hex format (e.g., "#000000")
	 */
	public set foregroundColor(value: string) {
		this._foregroundColor = value;
	}

	/**
	 * Get the error correction level of the QR code.
	 * @returns {ECLevel} The error correction level
	 * @default "M"
	 */
	public get errorCorrection(): ECLevel {
		return this._errorCorrection;
	}

	/**
	 * Set the error correction level of the QR code.
	 * Accepts initials ("L", "M", "Q", "H") or full names ("Low", "Medium", "Quartile", "High").
	 * @param value - The error correction level
	 */
	public set errorCorrection(value: ECLevel) {
		this._errorCorrection = value;
	}

	/**
	 * Get the cache instance.
	 * @returns {Cacheable | undefined} The cache instance or undefined if caching is disabled
	 */
	public get cache(): Cacheable | undefined {
		return this._cache;
	}

	/**
	 * Set the cache instance.
	 * @param value - The cache instance or undefined to disable caching
	 */
	public set cache(value: Cacheable | undefined) {
		this._cache = value;
	}

	/**
	 * Generate SVG QR code with optional caching.
	 * Uses QRCode library for simple cases, Rust implementation for logos.
	 * @param {toOptions} options - Generation options whether to use caching (default: true)
	 * @returns {Promise<string>} The SVG string
	 */
	public async toSvg(options?: toOptions): Promise<string> {
		let result = "";
		let renderKey = `native-svg`;

		if (this._logo) {
			renderKey = `napi-svg`;
		}

		// set all the options
		const qrOptions = {
			text: this._text,
			size: this._size,
			margin: this._margin,
			logo: this._logo,
			logoSizeRatio: this._logoSizeRatio,
			backgroundColor: this._backgroundColor,
			foregroundColor: this._foregroundColor,
		};

		// check the cache
		if (this._cache && options?.cache !== false) {
			const key = await this.generateCacheKey(renderKey);
			const cached = await this._cache.get<string>(key);
			if (cached) {
				return cached;
			}
		}

		if (!this._logo) {
			const qrCodeOptions: QRCodeToStringOptions = {
				type: "svg",
				width: qrOptions.size,
				errorCorrectionLevel: this._errorCorrection,
				color: {
					dark: qrOptions.foregroundColor,
					light: qrOptions.backgroundColor,
				},
			};

			result = await QRCode.toString(this._text, qrCodeOptions);
		} else {
			// If logoPath is set, use the Rust implementation
			result = await this.toSvgNapi();
		}

		if (this._cache && options?.cache !== false) {
			// set the cache, generate the key from hash
			const key = await this.generateCacheKey(renderKey);
			// cache the value
			await this._cache.set(key, result);
		}

		return result;
	}

	/**
	 * Generate SVG QR code using the native Rust implementation.
	 * Automatically chooses between file path and buffer functions.
	 * @returns {Promise<string>} The SVG string
	 */
	public async toSvgNapi(): Promise<string> {
		// Choose optimal path based on logo type
		if (this._logo && Buffer.isBuffer(this._logo)) {
			// Logo is already a buffer - use buffer function
			const nativeOptionsBuffer = {
				text: this._text,
				size: this._size,
				margin: this._margin,
				logoBuffer: this._logo,
				logoSizeRatio: this._logoSizeRatio,
				backgroundColor: this._backgroundColor,
				foregroundColor: this._foregroundColor,
				errorCorrection: this._errorCorrection,
			};
			return this._napi.generateQrSvgWithBuffer(nativeOptionsBuffer);
		} else {
			// Logo is a string path or undefined - use original function
			const nativeOptions = {
				text: this._text,
				size: this._size,
				margin: this._margin,
				logoPath: this._logo as string,
				logoSizeRatio: this._logoSizeRatio,
				backgroundColor: this._backgroundColor,
				foregroundColor: this._foregroundColor,
				errorCorrection: this._errorCorrection,
			};

			if (this._logo && this.isLogoString()) {
				if (!(await this.logoFileExists(this._logo as string))) {
					this.emit(
						QrBitEvents.error,
						logoFileDoesNotExistMessage(this._logo as string),
					);
				}
			}

			return this._napi.generateQrSvg(nativeOptions);
		}
	}

	/**
	 * Generate PNG QR code with optional caching.
	 * Generates the QR as Svg either in rust if it has a logo or native. Then does a conversion on it.
	 * @param options - Generation options
	 * @param options.cache - Whether to use caching (default: true)
	 * @returns {Promise<Buffer>} The PNG buffer
	 */
	public async toPng(options?: toOptions): Promise<Buffer> {
		let result: Buffer;
		const renderKey = `napi-png`;

		// check the cache
		if (this._cache && options?.cache !== false) {
			const key = await this.generateCacheKey(renderKey);
			const cached = await this._cache.get<Buffer>(key);
			if (cached) {
				// Ensure we return a Buffer, not Uint8Array
				return Buffer.from(cached);
			}
		}

		const svg = await this.toSvg(options);
		result = QrBit.convertSvgToPng(svg);

		if (this._cache && options?.cache !== false) {
			// set the cache, generate the key from hash
			const key = await this.generateCacheKey(renderKey);
			// cache the value
			await this._cache.set(key, result);
		}

		return result;
	}

	/**
	 * Generate PNG QR code and save it to a file.
	 * Creates directories if they don't exist.
	 * @param filePath - The file path where to save the PNG
	 * @param options - Generation options
	 * @param options.cache - Whether to use caching (default: true)
	 * @returns {Promise<void>} Resolves when file is written
	 */
	public async toPngFile(filePath: string, options?: toOptions): Promise<void> {
		const pngBuffer = await this.toPng(options);

		// Create directory if it doesn't exist
		const dir = path.dirname(filePath);
		await fs.promises.mkdir(dir, { recursive: true });

		await fs.promises.writeFile(filePath, pngBuffer);
	}

	/**
	 * Generate JPEG QR code with optional caching.
	 * Generates the QR as SVG either in rust if it has a logo or native. Then does a conversion on it.
	 * @param options - Generation options
	 * @param options.cache - Whether to use caching (default: true)
	 * @param options.quality - JPEG quality 1-100 (default: 90)
	 * @returns {Promise<Buffer>} The JPEG buffer
	 */
	public async toJpg(options?: toOptions): Promise<Buffer> {
		let result: Buffer;
		const quality = options?.quality ?? 90;
		const renderKey = `napi-jpeg-${quality}`;

		// check the cache
		if (this._cache && options?.cache !== false) {
			const key = await this.generateCacheKey(renderKey);
			const cached = await this._cache.get<Buffer>(key);
			if (cached) {
				// Ensure we return a Buffer, not Uint8Array
				return Buffer.from(cached);
			}
		}

		const svg = await this.toSvg(options);
		result = QrBit.convertSvgToJpeg(svg, undefined, undefined, quality);

		if (this._cache && options?.cache !== false) {
			// set the cache, generate the key from hash
			const key = await this.generateCacheKey(renderKey);
			// cache the value
			await this._cache.set(key, result);
		}

		return result;
	}

	/**
	 * Generate JPEG QR code and save it to a file.
	 * Creates directories if they don't exist.
	 * @param filePath - The file path where to save the JPEG
	 * @param options - Generation options
	 * @param options.cache - Whether to use caching (default: true)
	 * @param options.quality - JPEG quality 1-100 (default: 90)
	 * @returns {Promise<void>} Resolves when file is written
	 */
	public async toJpgFile(filePath: string, options?: toOptions): Promise<void> {
		const jpegBuffer = await this.toJpg(options);

		// Create directory if it doesn't exist
		const dir = path.dirname(filePath);
		await fs.promises.mkdir(dir, { recursive: true });

		await fs.promises.writeFile(filePath, jpegBuffer);
	}

	/**
	 * Generate WebP QR code with optional caching.
	 * Generates the QR as SVG either in rust if it has a logo or native. Then does a conversion on it.
	 * Note: WebP encoding uses lossless compression - quality parameter is reserved for future lossy support.
	 * @param options - Generation options
	 * @param options.cache - Whether to use caching (default: true)
	 * @param options.quality - Reserved for future lossy WebP support (currently ignored)
	 * @returns {Promise<Buffer>} The WebP buffer
	 */
	public async toWebp(options?: toOptions): Promise<Buffer> {
		let result: Buffer;
		const quality = options?.quality ?? 90;
		const renderKey = `napi-webp-${quality}`;

		// check the cache
		if (this._cache && options?.cache !== false) {
			const key = await this.generateCacheKey(renderKey);
			const cached = await this._cache.get<Buffer>(key);
			if (cached) {
				// Ensure we return a Buffer, not Uint8Array
				return Buffer.from(cached);
			}
		}

		const svg = await this.toSvg(options);
		result = QrBit.convertSvgToWebp(svg);

		if (this._cache && options?.cache !== false) {
			// set the cache, generate the key from hash
			const key = await this.generateCacheKey(renderKey);
			// cache the value
			await this._cache.set(key, result);
		}

		return result;
	}

	/**
	 * Generate WebP QR code and save it to a file.
	 * Creates directories if they don't exist.
	 * @param filePath - The file path where to save the WebP
	 * @param options - Generation options
	 * @param options.cache - Whether to use caching (default: true)
	 * @param options.quality - Reserved for future lossy WebP support (currently ignored)
	 * @returns {Promise<void>} Resolves when file is written
	 */
	public async toWebpFile(
		filePath: string,
		options?: toOptions,
	): Promise<void> {
		const webpBuffer = await this.toWebp(options);

		// Create directory if it doesn't exist
		const dir = path.dirname(filePath);
		await fs.promises.mkdir(dir, { recursive: true });

		await fs.promises.writeFile(filePath, webpBuffer);
	}

	/**
	 * Generate SVG QR code and save it to a file.
	 * Creates directories if they don't exist.
	 * @param filePath - The file path where to save the SVG
	 * @param options - Generation options
	 * @param options.cache - Whether to use caching (default: true)
	 * @returns {Promise<void>} Resolves when file is written
	 */
	public async toSvgFile(filePath: string, options?: toOptions): Promise<void> {
		const svgString = await this.toSvg(options);

		// Create directory if it doesn't exist
		const dir = path.dirname(filePath);
		await fs.promises.mkdir(dir, { recursive: true });

		await fs.promises.writeFile(filePath, svgString, "utf8");
	}

	/**
	 * Convert SVG content to PNG buffer using the native Rust implementation.
	 * @param svgContent - The SVG content as a string
	 * @param width - Optional width for the PNG output
	 * @param height - Optional height for the PNG output
	 * @returns {Buffer} The PNG buffer
	 */
	public static convertSvgToPng(
		svgContent: string,
		width?: number,
		height?: number,
	): Buffer {
		return nativeConvertSvgToPng(svgContent, width, height);
	}

	/**
	 * Convert SVG content to JPEG buffer using the native Rust implementation.
	 * @param svgContent - The SVG content as a string
	 * @param width - Optional width for the JPEG output
	 * @param height - Optional height for the JPEG output
	 * @param quality - Optional JPEG quality 1-100 (default: 90)
	 * @returns {Buffer} The JPEG buffer
	 */
	public static convertSvgToJpeg(
		svgContent: string,
		width?: number,
		height?: number,
		quality?: number,
	): Buffer {
		return nativeConvertSvgToJpeg(svgContent, width, height, quality);
	}

	/**
	 * Convert SVG content to WebP buffer using the native Rust implementation.
	 * Note: WebP encoding uses lossless compression - quality parameter is reserved for future lossy support.
	 * @param svgContent - The SVG content as a string
	 * @param width - Optional width for the WebP output
	 * @param height - Optional height for the WebP output
	 * @param quality - Reserved for future lossy WebP support (currently ignored)
	 * @returns {Buffer} The WebP buffer
	 */
	public static convertSvgToWebp(
		svgContent: string,
		width?: number,
		height?: number,
		quality?: number,
	): Buffer {
		return nativeConvertSvgToWebp(svgContent, width, height, quality);
	}

	/**
	 * Generate a cache key based on the current QR code options.
	 * @param {string} renderKey the format that you are rendering in such as `napi-png`, `native-svg`, `napi-svg`
	 * @returns {Promise<string>} The cache key
	 */
	public async generateCacheKey(renderKey: string): Promise<string> {
		const qrOptions = {
			text: this._text,
			size: this._size,
			margin: this._margin,
			logo: this._logo || undefined,
			logoSizeRatio: this._logoSizeRatio,
			backgroundColor: this._backgroundColor,
			foregroundColor: this._foregroundColor,
			errorCorrection: this._errorCorrection,
			renderKey,
		};

		const cache = this._cache || new Cacheable();

		return cache.hash(qrOptions);
	}

	/**
	 * Check if the logo is a string (file path).
	 * @returns {boolean} True if logo is a string, false otherwise
	 */
	public isLogoString(): boolean {
		return typeof this._logo === "string";
	}

	/**
	 * Check if a logo file exists at the specified path.
	 * @param filePath - The file path to check
	 * @returns {Promise<boolean>} True if file exists, false otherwise
	 */
	public async logoFileExists(filePath: string): Promise<boolean> {
		try {
			await fs.promises.access(filePath, fs.constants.F_OK);
			return true;
		} catch (_error) {
			return false;
		}
	}
}
