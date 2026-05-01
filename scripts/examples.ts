import fs from "node:fs";
import type { QrOptions, toOptions } from "../src/qrbit.js";

export type ExampleFormat = "png" | "svg" | "jpg" | "webp";

export type ExampleLogo = { kind: "path" } | { kind: "buffer" };

export type ExampleSpec = {
	name: string;
	format: ExampleFormat;
	options: Omit<QrOptions, "logo"> & { logo?: ExampleLogo };
	toOptions?: toOptions;
};

export const LOGO_PATH = "./test/fixtures/test_logo_large.png";

export function buildOptions(spec: ExampleSpec): QrOptions {
	const { logo, ...rest } = spec.options;
	if (!logo) return rest;
	if (logo.kind === "buffer") {
		return { ...rest, logo: fs.readFileSync(LOGO_PATH) };
	}
	return { ...rest, logo: LOGO_PATH };
}

export const examples: ExampleSpec[] = [
	{
		name: "01_basic",
		format: "png",
		options: { text: "Hello World!" },
	},
	{
		name: "02_url",
		format: "svg",
		options: { text: "https://github.com/jaredwray/qrbit", size: 200 },
	},
	{
		name: "03_large_size",
		format: "png",
		options: { text: "Large QR", size: 400 },
	},
	{
		name: "04_inverted",
		format: "svg",
		options: {
			text: "Inverted Colors",
			backgroundColor: "#000000",
			foregroundColor: "#FFFFFF",
		},
	},
	{
		name: "05_red_theme",
		format: "png",
		options: {
			text: "Red Theme",
			backgroundColor: "#FF0000",
			foregroundColor: "#FFFFFF",
		},
	},
	{
		name: "06_logo_small",
		format: "png",
		options: {
			text: "logo small",
			logo: { kind: "path" },
			logoSizeRatio: 0.2,
		},
	},
	{
		name: "07_logo_large_red",
		format: "svg",
		options: {
			text: "logo large red",
			logo: { kind: "path" },
			size: 400,
			logoSizeRatio: 0.3,
			backgroundColor: "#FF0000",
			foregroundColor: "#FFFFFF",
		},
	},
	{
		name: "08_wifi",
		format: "png",
		options: { text: "WIFI:T:WPA;S:MyNetwork;P:MyPassword;;" },
	},
	{
		name: "09_large_margin_blue",
		format: "svg",
		options: {
			text: "https://github.com/jaredwray/qrbit",
			size: 300,
			margin: 40,
			backgroundColor: "#0000FF",
			foregroundColor: "#FFFFFF",
		},
	},
	{
		name: "10_buffer_logo",
		format: "png",
		options: {
			text: "Buffer Logo",
			logo: { kind: "buffer" },
			logoSizeRatio: 0.2,
			backgroundColor: "#F0F0F0",
			foregroundColor: "#333333",
		},
	},
	{
		name: "11_jpg_high_quality",
		format: "jpg",
		options: { text: "High Quality JPEG", size: 300 },
		toOptions: { quality: 95 },
	},
	{
		name: "12_jpg_logo_blue",
		format: "jpg",
		options: {
			text: "JPEG with Logo",
			logo: { kind: "path" },
			size: 400,
			logoSizeRatio: 0.25,
			backgroundColor: "#2196F3",
			foregroundColor: "#FFFFFF",
		},
		toOptions: { quality: 90 },
	},
	{
		name: "13_jpg_compressed_green",
		format: "jpg",
		options: {
			text: "https://github.com/jaredwray/qrbit",
			size: 300,
			backgroundColor: "#4CAF50",
			foregroundColor: "#FFFFFF",
		},
		toOptions: { quality: 70 },
	},
	{
		name: "14_jpg_buffer_logo_orange",
		format: "jpg",
		options: {
			text: "JPEG Buffer Logo",
			logo: { kind: "buffer" },
			size: 350,
			logoSizeRatio: 0.2,
			backgroundColor: "#FF9800",
			foregroundColor: "#FFFFFF",
		},
		toOptions: { quality: 85 },
	},
	{
		name: "15_webp_basic",
		format: "webp",
		options: { text: "Basic WebP QR Code", size: 300 },
	},
	{
		name: "16_webp_logo_blue",
		format: "webp",
		options: {
			text: "WebP with Logo",
			logo: { kind: "path" },
			size: 400,
			logoSizeRatio: 0.25,
			backgroundColor: "#1e3a5f",
			foregroundColor: "#FFFFFF",
		},
	},
	{
		name: "17_webp_large_green",
		format: "webp",
		options: {
			text: "https://github.com/jaredwray/qrbit",
			size: 500,
			backgroundColor: "#4CAF50",
			foregroundColor: "#FFFFFF",
		},
	},
	{
		name: "18_webp_buffer_logo_purple",
		format: "webp",
		options: {
			text: "WebP Buffer Logo",
			logo: { kind: "buffer" },
			size: 350,
			logoSizeRatio: 0.2,
			backgroundColor: "#9C27B0",
			foregroundColor: "#FFFFFF",
		},
	},
	{
		name: "19_ec_low",
		format: "png",
		options: {
			text: "https://github.com/jaredwray/qrbit?test=this+is+an+error+correction+test",
			size: 400,
			errorCorrection: "L",
			backgroundColor: "#1e3a5f",
			foregroundColor: "#FFFFFF",
		},
	},
	{
		name: "20_ec_high",
		format: "png",
		options: {
			text: "https://github.com/jaredwray/qrbit?test=this+is+an+error+correction+test",
			size: 400,
			errorCorrection: "High",
			backgroundColor: "#1e3a5f",
			foregroundColor: "#FFFFFF",
		},
	},
];
