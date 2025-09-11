# QRBit

[![codecov](https://codecov.io/gh/jaredwray/qrbit/graph/badge.svg?token=VEUXLsudSh)](https://codecov.io/gh/jaredwray/qrbit)
[![tests](https://github.com/jaredwray/qrbit/actions/workflows/tests.yml/badge.svg)](https://github.com/jaredwray/qrbit/actions/workflows/tests.yml)
[![npm](https://img.shields.io/npm/v/qrbit)](https://www.npmjs.com/package/qrbit)
[![npm](https://img.shields.io/npm/dm/qrbit)](https://www.npmjs.com/package/qrbit)
[![license](https://img.shields.io/github/license/jaredwray/qrbit)](https://github.com/jaredwray/qrbit/blob/main/LICENSE)

A fast QR code generator with logo embedding support, built with Rust and native node packages for best performance while avoiding additional modules (example: canvas).

## Features

- **Fast**: Built with Rust (for logos) for maximum performance and caching 🚀
- **Fast SVG**: High performance SVG support via `QrCode` when no logo is needed
- **Cross-platform**: Works on iOS, Windows, Linux, and macOS
- **Logo embedding**: Add custom logos to your QR codes with no need for node canvas!
- **Customizable**: Custom colors, sizes, and margins
- **Multiple formats**: Generate SVG and PNG outputs
- **Scalable**: With caching you can also use a secondary store!
- **Well-tested**: Comprehensive test coverage with Vitest
- **Maintained**: Actively maintained with regular updates

## Installation

```bash
npm install qrbit
```

# Requirements

- Node.js >= 18
- Supported platforms: Windows, macOS, Linux (x86, x64, ARM64)

# Usage

```javascript
const qr = new QrBit({ text: "https://github.com/jaredwray/qrbit", size: 200 });
const svg = await qr.toSvg();
console.log(svg); // here is the svg!
```

Here is how you add a logo:

```javascript
const qr = new QrBit({ 
  text: "https://github.com/jaredwray/qrbit", 
  logo: '/path/to/logo.png',
  size: 200 });
const svg = await qr.toSvg();
console.log(svg); // here is the svg with an embedded logo!
```

# API

## constructor(options: QrOptions)

Creates a new QrBit instance with the specified options.

**Parameters:**
- `options` (QrOptions): Configuration object for the QR code

```typescript
interface QrOptions {
  text: string;                    // The text content to encode
  size?: number;                   // Size in pixels (default: 200)
  margin?: number;                 // Margin in pixels (default: undefined)
  logo?: string | Buffer;          // Logo file path or buffer
  logoSizeRatio?: number;          // Logo size ratio (default: 0.2)
  backgroundColor?: string;        // Background color (default: "#FFFFFF")
  foregroundColor?: string;        // Foreground color (default: "#000000")
  cache?: Cacheable | boolean;     // Caching configuration (default: true)
}
```

**Example:**
```javascript
import { QrBit } from 'qrbit';

const qr = new QrBit({
  text: "https://github.com/jaredwray/qrbit",
  size: 300,
  margin: 20,
  logo: "./logo.png",
  logoSizeRatio: 0.25,
  backgroundColor: "#FFFFFF",
  foregroundColor: "#000000"
});
```

## Properties

### text
Get or set the text content for the QR code.

```javascript
const qr = new QrBit({ text: "Hello World" });
console.log(qr.text); // "Hello World"
qr.text = "New content";
```

### size
Get or set the size of the QR code in pixels.

```javascript
const qr = new QrBit({ text: "Hello World" });
console.log(qr.size); // 200 (default)
qr.size = 400;
```

### margin
Get or set the margin around the QR code in pixels.

```javascript
const qr = new QrBit({ text: "Hello World" });
console.log(qr.margin); // undefined (default)
qr.margin = 20;
```

### logo
Get or set the logo as a file path or buffer.

```javascript
const qr = new QrBit({ text: "Hello World" });
qr.logo = "./path/to/logo.png";
// or
qr.logo = fs.readFileSync("./logo.png");
```

### logoSizeRatio
Get or set the logo size ratio relative to QR code size (0.0 to 1.0).

```javascript
const qr = new QrBit({ text: "Hello World" });
qr.logoSizeRatio = 0.3; // 30% of QR code size
```

### backgroundColor
Get or set the background color in hex format.

```javascript
const qr = new QrBit({ text: "Hello World" });
qr.backgroundColor = "#FF0000"; // Red background
```

### foregroundColor
Get or set the foreground color in hex format.

```javascript
const qr = new QrBit({ text: "Hello World" });
qr.foregroundColor = "#FFFFFF"; // White foreground
```

### cache
Get or set the cache instance for performance optimization.

```javascript
import { Cacheable } from 'cacheable';

const qr = new QrBit({ text: "Hello World" });
qr.cache = new Cacheable(); // Custom cache instance
qr.cache = false; // Disable caching
```

## Methods

### .toSvg(options?: toOptions): Promise<string>

Generate SVG QR code with optional caching. Uses native QRCode library for simple cases, Rust implementation for logos.

**Parameters:**
- `options.cache?: boolean` - Whether to use caching (default: true)

**Returns:** Promise<string> - The SVG string

```javascript
const qr = new QrBit({ text: "Hello World" });
const svg = await qr.toSvg();
console.log(svg); // <svg xmlns="http://www.w3.org/2000/svg"...

// Without caching
const svgNoCache = await qr.toSvg({ cache: false });
```

### .toSvgFile(filePath: string, options?: toOptions): Promise<void>

Generate SVG QR code and save it to a file. Creates directories if they don't exist.

**Parameters:**
- `filePath: string` - The file path where to save the SVG
- `options.cache?: boolean` - Whether to use caching (default: true)

**Returns:** Promise<void>

```javascript
const qr = new QrBit({ text: "Hello World" });
await qr.toSvgFile("./output/qr-code.svg");

// With options
await qr.toSvgFile("./output/qr-code.svg", { cache: false });
```

### .toPng(options?: toOptions): Promise<Buffer>

Generate PNG QR code with optional caching. Uses high-performance SVG to PNG conversion.

**Parameters:**
- `options.cache?: boolean` - Whether to use caching (default: true)

**Returns:** Promise<Buffer> - The PNG buffer

```javascript
const qr = new QrBit({ text: "Hello World" });
const pngBuffer = await qr.toPng();

// Save to file
fs.writeFileSync("qr-code.png", pngBuffer);

// Without caching
const pngNoCache = await qr.toPng({ cache: false });
```

### .toPngFile(filePath: string, options?: toOptions): Promise<void>

Generate PNG QR code and save it to a file. Creates directories if they don't exist.

**Parameters:**
- `filePath: string` - The file path where to save the PNG
- `options.cache?: boolean` - Whether to use caching (default: true)

**Returns:** Promise<void>

```javascript
const qr = new QrBit({ text: "Hello World" });
await qr.toPngFile("./output/qr-code.png");

// With options
await qr.toPngFile("./output/qr-code.png", { cache: false });
```

### QrBit.convertSvgToPng(svgContent: string, width?: number, height?: number): Buffer

Convert any SVG content to PNG buffer using the native Rust implementation.

**Parameters:**
- `svgContent: string` - The SVG content as a string
- `width?: number` - Optional width for the PNG output
- `height?: number` - Optional height for the PNG output

**Returns:** Buffer - The PNG buffer

```javascript
const svgContent = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">...</svg>';
const pngBuffer = QrBit.convertSvgToPng(svgContent);

// With custom dimensions
const pngCustom = QrBit.convertSvgToPng(svgContent, 400, 400);
```

# Benchmarks

## QR Codes SVG (No Logo)
|                  name                   |  summary  |  ops/sec  |  time/op  |  margin  |  samples  |
|-----------------------------------------|:---------:|----------:|----------:|:--------:|----------:|
|  QRCode toString (v1.5.4)               |    🥇     |       5K  |    211µs  |  ±0.46%  |       5K  |
|  QrBit toSvg (Native) (v0.1.0)          |   -4.5%   |       5K  |    226µs  |  ±0.91%  |       4K  |
|  QrBit toSvg (Rust) (v0.1.0)            |   -84%    |     774   |      1ms  |  ±1.32%  |     745   |
|  styled-qr-code-node toBuffer (v1.5.2)  |   -90%    |     470   |      2ms  |  ±1.32%  |     464   |

`Rust` is there for performance and when doing heavy image processing without needing node `canvas` installed. If you do not add a logo then the `Native` version is what you will get for SVG. 

## QR Codes PNG (No Logo)
|                  name                   |  summary  |  ops/sec  |  time/op  |  margin  |  samples  |
|-----------------------------------------|:---------:|----------:|----------:|:--------:|----------:|
|  QrBit toPng (v0.1.0)                   |    🥇     |       1K  |    681µs  |  ±0.63%  |       1K  |
|  QRCode toBuffer (v1.5.4)               |   -64%    |     539   |      2ms  |  ±1.48%  |     528   |
|  styled-qr-code-node toBuffer (v1.5.2)  |   -89%    |     169   |      6ms  |  ±1.16%  |     169   |

`Rust` is used for `toPng()` to optimize performance for PNG generation and heavy image processing without needing node `canvas` installed.

## QR Codes with Embedded Logos
|                name                |  summary  |  ops/sec  |  time/op  |  margin  |  samples  |
|------------------------------------|:---------:|----------:|----------:|:--------:|----------:|
|  QrBit PNG (Path) (v0.1.0)         |    🥇     |     926   |      1ms  |  ±0.47%  |     923   |
|  QrBit SVG (Path) (v0.1.0)         |   -32%    |     628   |      2ms  |  ±1.21%  |     613   |
|  QrBit PNG (Buffer) (v0.1.0)       |   -82%    |     169   |      6ms  |  ±0.72%  |     170   |
|  QrBit SVG (Buffer) (v0.1.0)       |   -83%    |     155   |      6ms  |  ±0.86%  |     155   |
|  styled-qr-code-node PNG (v1.5.2)  |   -88%    |     116   |      9ms  |  ±0.69%  |     116   |
|  styled-qr-code-node SVG (v1.5.2)  |   -89%    |     103   |     10ms  |  ±0.73%  |     103   |


## QR Codes SVG with Caching
|                  name                   |  summary  |  ops/sec  |  time/op  |  margin  |  samples  |
|-----------------------------------------|:---------:|----------:|----------:|:--------:|----------:|
|  QrBit toSvg (Native) (v0.1.0)          |    🥇     |      52K  |    148µs  |  ±1.96%  |       7K  |
|  QRCode toString (v1.5.4)               |   -90%    |       5K  |    206µs  |  ±0.45%  |       5K  |
|  QrBit toSvg (Rust) (v0.1.0)            |   -99%    |     772   |      1ms  |  ±1.26%  |     746   |
|  styled-qr-code-node toBuffer (v1.5.2)  |   -99%    |     471   |      2ms  |  ±1.44%  |     464   |


## QR Codes PNG with Caching
|                  name                   |  summary  |  ops/sec  |  time/op  |  margin  |  samples  |
|-----------------------------------------|:---------:|----------:|----------:|:--------:|----------:|
|  QrBit toPng (v0.1.0)                   |    🥇     |      13K  |    605µs  |  ±1.81%  |       2K  |
|  QRCode toBuffer (v1.5.4)               |   -96%    |     535   |      2ms  |  ±1.61%  |     523   |
|  styled-qr-code-node toBuffer (v1.5.2)  |   -99%    |     165   |      6ms  |  ±0.95%  |     165   |

# Examples

The `examples/` directory contains various QR code examples showcasing different features and use cases. You can generate these examples by running:

```bash
pnpm generate-examples
```

## 1. Basic QR Code
Simple QR code with default settings.
```javascript
const qr = new QrBit({ text: "Hello World!" });
await qr.toPngFile("01_basic.png");
```
![Basic QR Code](examples/01_basic.png)

## 2. URL QR Code  
QR code encoding a GitHub URL.
```javascript
const qr = new QrBit({ text: "https://github.com/jaredwray/qrbit", size: 200 });
await qr.toSvgFile("02_url.svg");
```
![URL QR Code](examples/02_url.svg)

## 3. Large Size QR Code
QR code with increased size for better scanning.
```javascript
const qr = new QrBit({ text: "Large QR", size: 400 });
await qr.toPngFile("03_large_size.png");
```
![Large QR Code](examples/03_large_size.png)

## 4. Inverted Colors
Black background with white foreground.
```javascript
const qr = new QrBit({
  text: "Inverted Colors",
  backgroundColor: "#000000",
  foregroundColor: "#FFFFFF"
});
await qr.toSvgFile("04_inverted.svg");
```
![Inverted QR Code](examples/04_inverted.svg)

## 5. Red Theme
Custom red background theme.
```javascript
const qr = new QrBit({
  text: "Red Theme",
  backgroundColor: "#FF0000",
  foregroundColor: "#FFFFFF"
});
await qr.toPngFile("05_red_theme.png");
```
![Red Theme QR Code](examples/05_red_theme.png)

## 6. Small Logo
QR code with a small embedded logo.
```javascript
const qr = new QrBit({
  text: "logo small",
  logo: "./logo.png",
  logoSizeRatio: 0.2
});
await qr.toPngFile("06_logo_small.png");
```
![Small Logo QR Code](examples/06_logo_small.png)

## 7. Large Logo with Custom Colors
Large logo with red background theme.
```javascript
const qr = new QrBit({
  text: "logo large red",
  logo: "./logo.png",
  size: 400,
  logoSizeRatio: 0.3,
  backgroundColor: "#FF0000",
  foregroundColor: "#FFFFFF"
});
await qr.toSvgFile("07_logo_large_red.svg");
```
![Large Logo QR Code](examples/07_logo_large_red.svg)

## 8. WiFi QR Code
QR code for WiFi network connection.
```javascript
const qr = new QrBit({ 
  text: "WIFI:T:WPA;S:MyNetwork;P:MyPassword;;" 
});
await qr.toPngFile("08_wifi.png");
```
![WiFi QR Code](examples/08_wifi.png)

## 9. Large Margin with Blue Theme
Custom margin and blue color scheme.
```javascript
const qr = new QrBit({
  text: "https://github.com/jaredwray/qrbit",
  size: 300,
  margin: 40,
  backgroundColor: "#0000FF",
  foregroundColor: "#FFFFFF"
});
await qr.toSvgFile("09_large_margin_blue.svg");
```
![Large Margin Blue QR Code](examples/09_large_margin_blue.svg)

## 10. Buffer Logo
Using a logo loaded from a Buffer instead of file path.
```javascript
const logoBuffer = fs.readFileSync("./logo.png");
const qr = new QrBit({
  text: "Buffer Logo",
  logo: logoBuffer,
  logoSizeRatio: 0.2,
  backgroundColor: "#F0F0F0",
  foregroundColor: "#333333"
});
await qr.toPngFile("10_buffer_logo.png");
```
![Buffer Logo QR Code](examples/10_buffer_logo.png)

These examples demonstrate the versatility and capabilities of QrBit for generating QR codes with various customizations, from simple text encoding to complex styled codes with embedded logos.

## Contributing

Please read our [Contributing Guidelines](./CONTRIBUTING.md) and also our [Code of Conduct](./CODE_OF_CONDUCT.md). 

## License and Copyright

[MIT & Copyright (c) Jared Wray](https://github.com/jaredwray/qrbit/blob/main/LICENSE)
