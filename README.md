# QRBit

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

# Usage


# Requirements

- Node.js >= 18
- Supported platforms: Windows, macOS, Linux (x86, x64, ARM64)

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
