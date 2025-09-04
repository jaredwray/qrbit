import { Buffer } from "node:buffer";
import fs from "node:fs";
import { Cacheable } from "cacheable";
import { Hookified, type HookifiedOptions } from "hookified";
import QRCode from "qrcode";
import {
	generateQr as nativeGenerateQr,
	generateQrPng as nativeGenerateQrPng,
	generateQrPngWithBuffer as nativeGenerateQrPngWithBuffer,
	generateQrSvg as nativeGenerateQrSvg,
	generateQrSvgWithBuffer as nativeGenerateQrSvgWithBuffer,
} from "./native.js";

export enum QrBitEvents {
	warn = "warn",
	info = "info",
	error = "error",
}

export type QrOptions = {
	text: string;
	size?: number;
	margin?: number;
	logo?: string | Buffer;
	logoSizeRatio?: number;
	backgroundColor?: string;
	foregroundColor?: string;
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
};

export class QrBit extends Hookified {
	private _text: string;
	private _size: number;
	private _margin: number;
	private _logo: string | Buffer | undefined;
	private _logoSizeRatio: number;
	private _backgroundColor: string;
	private _foregroundColor: string;
	private _cache: Cacheable | undefined;

	constructor(options: QrOptions) {
		super();
		this._text = options.text;
		this._size = options.size ?? 200;
		this._margin = options.margin ?? 20;
		this._logo = options.logo;
		this._logoSizeRatio = options.logoSizeRatio ?? 0.2;
		this._backgroundColor = options.backgroundColor ?? "#FFFFFF";
		this._foregroundColor = options.foregroundColor ?? "#000000";
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
	}

	public get text(): string {
		return this._text;
	}

	public set text(value: string) {
		this._text = value;
	}

	public get size(): number {
		return this._size;
	}

	public set size(value: number) {
		this._size = value;
	}

	public get margin(): number {
		return this._margin;
	}

	public set margin(value: number) {
		this._margin = value;
	}

	public get logo(): string | Buffer | undefined {
		return this._logo;
	}

	public set logo(value: string | Buffer | undefined) {
		this._logo = value;
	}

	public get logoSizeRatio(): number {
		return this._logoSizeRatio;
	}

	public set logoSizeRatio(value: number) {
		this._logoSizeRatio = value;
	}

	public get backgroundColor(): string {
		return this._backgroundColor;
	}

	public set backgroundColor(value: string) {
		this._backgroundColor = value;
	}

	public get foregroundColor(): string {
		return this._foregroundColor;
	}

	public set foregroundColor(value: string) {
		this._foregroundColor = value;
	}

	public get cache(): Cacheable | undefined {
		return this._cache;
	}

	public set cache(value: Cacheable | undefined) {
		this._cache = value;
	}

	public async toSvg(options?: toOptions): Promise<string> {
		let result = "";

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
			const key = this.generateCacheKey();
			const cached = await this._cache.get<string>(key);
			if (cached) {
				return cached;
			}
		}

		if (!this._logo) {
			result = await QRCode.toString(this._text, {
				type: "svg",
				margin: qrOptions.margin,
				width: qrOptions.size,
				color: {
					dark: qrOptions.foregroundColor,
					light: qrOptions.backgroundColor,
				},
			});
		} else {
			// If logoPath is set, use the Rust implementation
			result = await this.toSvgNapi();
		}

		if (this._cache && options?.cache !== false) {
			// set the cache, generate the key from hash
			const key = this.generateCacheKey();
			// cache the value
			await this._cache.set(key, result);
		}

		return result;
	}

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
			};
			return nativeGenerateQrSvgWithBuffer(nativeOptionsBuffer);
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
			};
			return nativeGenerateQrSvg(nativeOptions);
		}
	}

	public async toPng(options?: toOptions): Promise<Buffer> {
		let result: Buffer;

		// check the cache
		if (this._cache && options?.cache !== false) {
			const key = this.generateCacheKey();
			const cached = await this._cache.get<Buffer>(key);
			if (cached) {
				// Ensure we return a Buffer, not Uint8Array
				return Buffer.from(cached);
			}
		}

		// always use png napi as it is fastest
		result = await this.toPngNapi();

		if (this._cache && options?.cache !== false) {
			// set the cache, generate the key from hash
			const key = this.generateCacheKey();
			// cache the value
			await this._cache.set(key, result);
		}

		return result;
	}

	public async toPngNapi(): Promise<Buffer> {
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
			};
			return nativeGenerateQrPngWithBuffer(nativeOptionsBuffer);
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
			};
			return nativeGenerateQrPng(nativeOptions);
		}
	}

	public async generate(): Promise<QrResult> {
		const nativeOptions = {
			text: this._text,
			size: this._size,
			margin: this._margin,
			logo: this._logo || undefined,
			logoSizeRatio: this._logoSizeRatio,
			backgroundColor: this._backgroundColor,
			foregroundColor: this._foregroundColor,
		};

		if (this._logo && this.isLogoString()) {
			if (!fs.existsSync(this._logo)) {
				throw new Error(`Logo file not found: ${this._logo}`);
			}
		}

		return nativeGenerateQr(nativeOptions);
	}

	public generateCacheKey(): string {
		const qrOptions = {
			text: this._text,
			size: this._size,
			margin: this._margin,
			logo: this._logo || undefined,
			logoSizeRatio: this._logoSizeRatio,
			backgroundColor: this._backgroundColor,
			foregroundColor: this._foregroundColor,
		};

		const cache = this._cache || new Cacheable();

		return cache.hash(qrOptions);
	}

	public isLogoString(): boolean {
		return typeof this._logo === "string";
	}
}
