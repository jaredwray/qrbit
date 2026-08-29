import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

/**
 * Hand-written napi-rs loader. Stock `@napi-rs/cli` bindings spawn `ldd` and
 * try optional packages for triples this package does not ship. This file
 * loads only the five published `.node` artifacts and detects musl via
 * `/usr/bin/ldd` and `process.report`.
 */
export const SUPPORTED_NATIVE_BINDINGS = [
	"qrbit.darwin-arm64.node",
	"qrbit.darwin-x64.node",
	"qrbit.linux-x64-gnu.node",
	"qrbit.linux-x64-musl.node",
	"qrbit.win32-x64-msvc.node",
] as const;

export type NativeBindingName = (typeof SUPPORTED_NATIVE_BINDINGS)[number];

export type ProcessReportSnapshot = {
	header?: {
		glibcVersionRuntime?: string;
	};
	sharedObjects?: string[];
};

export type ProcessReportLike = {
	excludeNetwork?: boolean;
	getReport?: () => ProcessReportSnapshot | undefined;
};

export type MuslDetectionIo = {
	readLdd?: () => string;
	report?: ProcessReportLike;
};

export type NativeQrOptions = {
	text: string;
	size?: number;
	margin?: number;
	logoPath?: string;
	logoSizeRatio?: number;
	logoBackgroundColor?: string;
	logoPaddingRatio?: number;
	backgroundColor?: string;
	foregroundColor?: string;
	errorCorrection?: string;
};

export type NativeQrOptionsWithBuffer = Omit<NativeQrOptions, "logoPath"> & {
	logoBuffer?: Buffer;
};

export type NativeQrCodeSvgOptions = {
	text: string;
	errorCorrection?: string;
	width?: number;
	margin?: number;
	darkColor?: string;
	lightColor?: string;
};

export type NativeDecodeResult = {
	valid: boolean;
	data?: string;
	format: string;
	version?: number;
	ecl?: string;
	error?: string;
};

export type NativeBinding = {
	convertSvgToJpeg: (
		svgContent: string,
		width?: number | null,
		height?: number | null,
		quality?: number | null,
	) => Buffer;
	convertSvgToPng: (
		svgContent: string,
		width?: number | null,
		height?: number | null,
	) => Buffer;
	convertSvgToWebp: (
		svgContent: string,
		width?: number | null,
		height?: number | null,
		quality?: number | null,
	) => Buffer;
	decode: (input: Buffer) => string | null;
	decodeDetailed: (input: Buffer) => NativeDecodeResult;
	generateQrCodeSvg: (options: NativeQrCodeSvgOptions) => string;
	generateQrSvg: (options: NativeQrOptions) => string;
	generateQrSvgWithBuffer: (options: NativeQrOptionsWithBuffer) => string;
	validateQr: (input: Buffer) => NativeDecodeResult;
};

const isFileMusl = (value: string): boolean =>
	value.includes("libc.musl-") || value.includes("ld-musl-");

const defaultReadLdd = (): string => readFileSync("/usr/bin/ldd", "utf8");

export function detectMuslFromFilesystem(
	readLdd: () => string = defaultReadLdd,
): boolean | null {
	try {
		return readLdd().includes("musl");
	} catch {
		return null;
	}
}

export function detectMuslFromReport(
	report: ProcessReportLike | undefined,
): boolean | null {
	if (!report || typeof report.getReport !== "function") {
		return null;
	}
	report.excludeNetwork = true;
	const snapshot = report.getReport();
	if (!snapshot) {
		return null;
	}
	if (snapshot.header?.glibcVersionRuntime) {
		return false;
	}
	if (
		Array.isArray(snapshot.sharedObjects) &&
		snapshot.sharedObjects.some(isFileMusl)
	) {
		return true;
	}
	return false;
}

export function detectMusl(io: MuslDetectionIo = {}): boolean {
	const fromFilesystem = detectMuslFromFilesystem(io.readLdd ?? defaultReadLdd);
	if (fromFilesystem !== null) {
		return fromFilesystem;
	}
	const fromReport = detectMuslFromReport(
		io.report ?? (process as { report?: ProcessReportLike }).report,
	);
	if (fromReport !== null) {
		return fromReport;
	}
	return false;
}

export function resolveNativeBindingName(
	platform = process.platform,
	arch = process.arch,
	musl?: boolean,
): NativeBindingName {
	const isMusl = musl ?? (platform === "linux" ? detectMusl() : false);
	if (platform === "darwin") {
		if (arch === "arm64") {
			return "qrbit.darwin-arm64.node";
		}
		if (arch === "x64") {
			return "qrbit.darwin-x64.node";
		}
	} else if (platform === "linux") {
		if (arch === "x64") {
			return isMusl ? "qrbit.linux-x64-musl.node" : "qrbit.linux-x64-gnu.node";
		}
	} else if (platform === "win32" && arch === "x64") {
		return "qrbit.win32-x64-msvc.node";
	}

	throw new Error(
		`Unsupported platform ${platform}-${arch}. qrbit ships native bindings for ${SUPPORTED_NATIVE_BINDINGS.join(", ")}.`,
	);
}

export function requireNativeBinding(
	requireFn: (id: string) => unknown,
	bindingName: string,
): NativeBinding {
	try {
		return requireFn(`./${bindingName}`) as NativeBinding;
	} catch (error) {
		throw new Error(
			`Cannot find native binding ${bindingName}. qrbit ships ${SUPPORTED_NATIVE_BINDINGS.join(", ")}.`,
			{ cause: error },
		);
	}
}

const nodeRequire = createRequire(import.meta.url);
const nativeBinding = requireNativeBinding(
	(id) => nodeRequire(id),
	resolveNativeBindingName(),
);

export const convertSvgToJpeg = nativeBinding.convertSvgToJpeg;
export const convertSvgToPng = nativeBinding.convertSvgToPng;
export const convertSvgToWebp = nativeBinding.convertSvgToWebp;
export const decode = nativeBinding.decode;
export const decodeDetailed = nativeBinding.decodeDetailed;
export const generateQrCodeSvg = nativeBinding.generateQrCodeSvg;
export const generateQrSvg = nativeBinding.generateQrSvg;
export const generateQrSvgWithBuffer = nativeBinding.generateQrSvgWithBuffer;
export const validateQr = nativeBinding.validateQr;
