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
	private options: Required<QrOptions>;

	constructor(options: QrOptions) {
		this.options = {
			text: options.text,
			size: options.size ?? 200,
			margin: options.margin ?? 20,
			logoPath: options.logoPath ?? "",
			logoSizeRatio: options.logoSizeRatio ?? 0.2,
			backgroundColor: options.backgroundColor ?? "#FFFFFF",
			foregroundColor: options.foregroundColor ?? "#000000",
		};
	}

	generateSvg(): string {
		const nativeOptions = {
			text: this.options.text,
			size: this.options.size,
			margin: this.options.margin,
			logoPath: this.options.logoPath || undefined,
			logoSizeRatio: this.options.logoSizeRatio,
			backgroundColor: this.options.backgroundColor,
			foregroundColor: this.options.foregroundColor,
		};

		return nativeGenerateQrSvg(nativeOptions);
	}

	generatePng(): Buffer {
		const nativeOptions = {
			text: this.options.text,
			size: this.options.size,
			margin: this.options.margin,
			logoPath: this.options.logoPath || undefined,
			logoSizeRatio: this.options.logoSizeRatio,
			backgroundColor: this.options.backgroundColor,
			foregroundColor: this.options.foregroundColor,
		};

		return nativeGenerateQrPng(nativeOptions);
	}

	generate(): QrResult {
		const nativeOptions = {
			text: this.options.text,
			size: this.options.size,
			margin: this.options.margin,
			logoPath: this.options.logoPath || undefined,
			logoSizeRatio: this.options.logoSizeRatio,
			backgroundColor: this.options.backgroundColor,
			foregroundColor: this.options.foregroundColor,
		};

		return nativeGenerateQr(nativeOptions);
	}

	setSize(size: number): QrBit {
		this.options.size = size;
		return this;
	}

	setMargin(margin: number): QrBit {
		this.options.margin = margin;
		return this;
	}

	setLogo(logoPath: string, sizeRatio?: number): QrBit {
		this.options.logoPath = logoPath;
		if (sizeRatio !== undefined) {
			this.options.logoSizeRatio = sizeRatio;
		}
		return this;
	}

	setColors(backgroundColor: string, foregroundColor: string): QrBit {
		this.options.backgroundColor = backgroundColor;
		this.options.foregroundColor = foregroundColor;
		return this;
	}
}

export function generateQr(options: QrOptions): QrResult {
	const qr = new QrBit(options);
	return qr.generate();
}

export function generateSvg(
	text: string,
	options?: Omit<QrOptions, "text">,
): string {
	const nativeOptions = {
		text,
		size: options?.size,
		margin: options?.margin,
		logoPath: options?.logoPath,
		logoSizeRatio: options?.logoSizeRatio,
		backgroundColor: options?.backgroundColor,
		foregroundColor: options?.foregroundColor,
	};

	return nativeGenerateQrSvg(nativeOptions);
}

export function generatePng(
	text: string,
	options?: Omit<QrOptions, "text">,
): Buffer {
	const nativeOptions = {
		text,
		size: options?.size,
		margin: options?.margin,
		logoPath: options?.logoPath,
		logoSizeRatio: options?.logoSizeRatio,
		backgroundColor: options?.backgroundColor,
		foregroundColor: options?.foregroundColor,
	};

	return nativeGenerateQrPng(nativeOptions);
}
