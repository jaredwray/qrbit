import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	detectMusl,
	detectMuslFromFilesystem,
	detectMuslFromReport,
	generateQrCodeSvg,
	requireNativeBinding,
	resolveNativeBindingName,
	SUPPORTED_NATIVE_BINDINGS,
} from "../src/native.js";

const loaderSources = [
	"src/native.ts",
	"dist/native.js",
	"dist/native.cjs",
].filter((file) => existsSync(file));

describe("native loader policy", () => {
	it("does not spawn a process or load unpublished triples", () => {
		expect(loaderSources.length).toBeGreaterThan(0);
		for (const file of loaderSources) {
			const source = readFileSync(file, "utf8");
			expect(source, file).not.toMatch(
				/node:child_process|require\(["']child_process["']\)/,
			);
			expect(source, file).not.toMatch(/execSync\s*\(/);
			expect(source, file).not.toMatch(/NAPI_RS_NATIVE_LIBRARY_PATH/);
			expect(source, file).not.toMatch(/android-arm/);
			expect(source, file).not.toMatch(/freebsd/);
			expect(source, file).not.toMatch(/wasm32/);
		}
	});

	it("lists only the five published bindings", () => {
		expect(SUPPORTED_NATIVE_BINDINGS).toEqual([
			"qrbit.darwin-arm64.node",
			"qrbit.darwin-x64.node",
			"qrbit.linux-x64-gnu.node",
			"qrbit.linux-x64-musl.node",
			"qrbit.win32-x64-msvc.node",
		]);
	});

	it("loads the host native binding", () => {
		const svg = generateQrCodeSvg({ text: "https://example.com" });
		expect(svg).toContain("<svg");
	});
});

describe("detectMuslFromFilesystem", () => {
	it("reads /usr/bin/ldd by default", () => {
		const result = detectMuslFromFilesystem();
		expect([true, false, null]).toContain(result);
	});

	it("returns true when ldd mentions musl", () => {
		expect(detectMuslFromFilesystem(() => "musl libc (x86_64)")).toBe(true);
	});

	it("returns false when ldd is present without musl", () => {
		expect(detectMuslFromFilesystem(() => "ldd (GNU libc) 2.39")).toBe(false);
	});

	it("returns null when ldd cannot be read", () => {
		expect(
			detectMuslFromFilesystem(() => {
				throw new Error("ENOENT");
			}),
		).toBeNull();
	});
});

describe("detectMuslFromReport", () => {
	it("returns null without a usable report", () => {
		expect(detectMuslFromReport(undefined)).toBeNull();
		expect(detectMuslFromReport({})).toBeNull();
		expect(detectMuslFromReport({ getReport: undefined })).toBeNull();
	});

	it("returns null when getReport yields nothing", () => {
		expect(
			detectMuslFromReport({
				getReport: () => undefined,
			}),
		).toBeNull();
	});

	it("returns false when glibc is reported", () => {
		const report = {
			excludeNetwork: false,
			getReport: () => ({
				header: { glibcVersionRuntime: "2.39" },
				sharedObjects: ["libc.musl-x86_64.so.1"],
			}),
		};
		expect(detectMuslFromReport(report)).toBe(false);
		expect(report.excludeNetwork).toBe(true);
	});

	it("returns true when shared objects are musl", () => {
		expect(
			detectMuslFromReport({
				getReport: () => ({
					sharedObjects: ["/lib/ld-musl-x86_64.so.1"],
				}),
			}),
		).toBe(true);
	});

	it("returns false when the report has neither glibc nor musl", () => {
		expect(
			detectMuslFromReport({
				getReport: () => ({
					header: {},
					sharedObjects: ["libc.so.6"],
				}),
			}),
		).toBe(false);
		expect(
			detectMuslFromReport({
				getReport: () => ({}),
			}),
		).toBe(false);
	});
});

describe("detectMusl", () => {
	it("prefers the filesystem probe", () => {
		expect(
			detectMusl({
				readLdd: () => "musl libc",
				report: {
					getReport: () => ({ header: { glibcVersionRuntime: "2.39" } }),
				},
			}),
		).toBe(true);
		expect(
			detectMusl({
				readLdd: () => "GNU libc",
			}),
		).toBe(false);
	});

	it("falls back to process.report when ldd is missing", () => {
		expect(
			detectMusl({
				readLdd: () => {
					throw new Error("ENOENT");
				},
				report: {
					getReport: () => ({
						sharedObjects: ["libc.musl-aarch64.so.1"],
					}),
				},
			}),
		).toBe(true);
		expect(
			detectMusl({
				readLdd: () => {
					throw new Error("ENOENT");
				},
				report: {
					getReport: () => ({ header: { glibcVersionRuntime: "2.39" } }),
				},
			}),
		).toBe(false);
	});

	it("returns false when both probes are unavailable", () => {
		expect(
			detectMusl({
				readLdd: () => {
					throw new Error("ENOENT");
				},
				report: {},
			}),
		).toBe(false);
	});

	it("uses process.report when no report override is given", () => {
		expect(
			detectMusl({
				readLdd: () => {
					throw new Error("ENOENT");
				},
			}),
		).toBeTypeOf("boolean");
	});

	it("uses default filesystem and report probes", () => {
		expect(detectMusl()).toBeTypeOf("boolean");
	});
});

describe("resolveNativeBindingName", () => {
	it("resolves the host triple", () => {
		expect(SUPPORTED_NATIVE_BINDINGS).toContain(resolveNativeBindingName());
	});

	it("resolves the five published triples", () => {
		expect(resolveNativeBindingName("darwin", "arm64")).toBe(
			"qrbit.darwin-arm64.node",
		);
		expect(resolveNativeBindingName("darwin", "x64")).toBe(
			"qrbit.darwin-x64.node",
		);
		expect(resolveNativeBindingName("linux", "x64", false)).toBe(
			"qrbit.linux-x64-gnu.node",
		);
		expect(resolveNativeBindingName("linux", "x64", true)).toBe(
			"qrbit.linux-x64-musl.node",
		);
		expect(resolveNativeBindingName("win32", "x64")).toBe(
			"qrbit.win32-x64-msvc.node",
		);
	});

	it("detects musl when linux musl is omitted", () => {
		expect(resolveNativeBindingName("linux", "x64")).toMatch(
			/^qrbit\.linux-x64-(gnu|musl)\.node$/,
		);
	});

	it("does not treat non-linux hosts as musl", () => {
		expect(resolveNativeBindingName("darwin", "arm64")).toBe(
			"qrbit.darwin-arm64.node",
		);
	});

	it("rejects unpublished platforms", () => {
		expect(() => resolveNativeBindingName("darwin", "ia32")).toThrow(
			/Unsupported platform darwin-ia32/,
		);
		expect(() => resolveNativeBindingName("linux", "arm64", false)).toThrow(
			/Unsupported platform linux-arm64/,
		);
		expect(() => resolveNativeBindingName("win32", "arm64")).toThrow(
			/Unsupported platform win32-arm64/,
		);
		expect(() => resolveNativeBindingName("freebsd", "x64")).toThrow(
			/Unsupported platform freebsd-x64/,
		);
	});
});

describe("requireNativeBinding", () => {
	it("loads the relative binding name", () => {
		const loaded = { ok: true };
		expect(
			requireNativeBinding((id) => {
				expect(id).toBe("./qrbit.linux-x64-gnu.node");
				return loaded;
			}, "qrbit.linux-x64-gnu.node"),
		).toBe(loaded);
	});

	it("wraps a missing binding with the published set", () => {
		const cause = new Error("MODULE_NOT_FOUND");
		try {
			requireNativeBinding(() => {
				throw cause;
			}, "qrbit.linux-x64-gnu.node");
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(Error);
			expect((error as Error).message).toContain(
				"Cannot find native binding qrbit.linux-x64-gnu.node",
			);
			expect((error as Error).cause).toBe(cause);
		}
	});
});
