// Import Node.js Buffer type
import type { Buffer } from "node:buffer";

import {
	generateQr as nativeGenerateQr,
	generateQrPng as nativeGenerateQrPng,
	generateQrSvg as nativeGenerateQrSvg,
} from "./native.js";

export interface QrOptions {
	text: string;
	size?: number;
	margin?: number;
	logoPath?: string;
	logoSizeRatio?: number;
	backgroundColor?: string;
	foregroundColor?: string;
}

export interface QrResult {
	svg?: string;
	png?: Buffer;
	width: number;
	height: number;
}

export class QrBit {
	private _text: string;
	private _size: number;
	private _margin: number;
	private _logoPath: string;
	private _logoSizeRatio: number;
	private _backgroundColor: string;
	private _foregroundColor: string;

	constructor(options: QrOptions) {
		this._text = options.text;
		this._size = options.size ?? 200;
		this._margin = options.margin ?? 20;
		this._logoPath = options.logoPath ?? "";
		this._logoSizeRatio = options.logoSizeRatio ?? 0.2;
		this._backgroundColor = options.backgroundColor ?? "#FFFFFF";
		this._foregroundColor = options.foregroundColor ?? "#000000";
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

	public get logoPath(): string {
		return this._logoPath;
	}

	public set logoPath(value: string) {
		this._logoPath = value;
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

	public async generateSvg(): Promise<string> {
		const nativeOptions = {
			text: this._text,
			size: this._size,
			margin: this._margin,
			logoPath: this._logoPath || undefined,
			logoSizeRatio: this._logoSizeRatio,
			backgroundColor: this._backgroundColor,
			foregroundColor: this._foregroundColor,
		};

		return nativeGenerateQrSvg(nativeOptions);
	}

	public async generatePng(): Promise<Buffer> {
		const nativeOptions = {
			text: this._text,
			size: this._size,
			margin: this._margin,
			logoPath: this._logoPath || undefined,
			logoSizeRatio: this._logoSizeRatio,
			backgroundColor: this._backgroundColor,
			foregroundColor: this._foregroundColor,
		};

		return nativeGenerateQrPng(nativeOptions);
	}

	public async generate(): Promise<QrResult> {
		const nativeOptions = {
			text: this._text,
			size: this._size,
			margin: this._margin,
			logoPath: this._logoPath || undefined,
			logoSizeRatio: this._logoSizeRatio,
			backgroundColor: this._backgroundColor,
			foregroundColor: this._foregroundColor,
		};

		return nativeGenerateQr(nativeOptions);
	}
}
