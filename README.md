# QRBit

A fast QR code generator with logo embedding support, built with Rust and usable in Node.js via NAPI-RS.

## Features

- **Fast**: Built with Rust (for logos) for maximum performance and caching 🚀
- **Fast SVG**: High performance SVG support via `QrCode` when no logo is needed
- **Cross-platform**: Works on iOS, Windows, Linux, and macOS
- **Logo embedding**: Add custom logos to your QR codes with no need for node canvas!
- **Customizable**: Custom colors, sizes, and margins
- **Multiple formats**: Generate SVG and PNG outputs
- **Well-tested**: Comprehensive test coverage with Vitest
- **Maintained**: Actively maintained with regular updates

## Installation

```bash
npm install qrbit
```

## Usage


## Requirements

- Node.js >= 18
- Supported platforms: Windows, macOS, Linux (x86, x64, ARM64)

# Benchmarks

## Non-Logo Generation

|                name                |  summary  |  ops/sec  |  time/op  |  margin  |  samples  |
|------------------------------------|:---------:|----------:|----------:|:--------:|----------:|
|  QRCode SVG (v1.5.4)               |    🥇     |       5K  |    212µs  |  ±0.49%  |       5K  |
|  QrBit PNG (v0.1.0)                |   -70%    |       1K  |    688µs  |  ±0.52%  |       1K  |
|  QrBit SVG (v0.1.0)                |   -84%    |     764   |      1ms  |  ±1.34%  |     736   |
|  QRCode PNG (v1.5.4)               |   -89%    |     540   |      2ms  |  ±0.99%  |     534   |
|  styled-qr-code-node SVG (v1.5.2)  |   -90%    |     468   |      2ms  |  ±1.21%  |     462   |
|  styled-qr-code-node (v1.5.2)      |   -97%    |     168   |      6ms  |  ±0.83%  |     168   


## Logo Generation

|                name                |  summary  |  ops/sec  |  time/op  |  margin  |  samples  |
|------------------------------------|:---------:|----------:|----------:|:--------:|----------:|
|  QrBit PNG (v0.1.0)                |    🥇     |     920   |      1ms  |  ±0.50%  |     915   |
|  QrBit SVG (v0.1.0)                |   -22%    |     721   |      1ms  |  ±1.08%  |     702   |
|  styled-qr-code-node PNG (v1.5.2)  |   -88%    |     115   |      9ms  |  ±0.64%  |     115   |
|  styled-qr-code-node SVG (v1.5.2)  |   -89%    |     102   |     10ms  |  ±0.81%  |     102   |

## License and Copyright

[MIT & Copyright (c) Jared Wray](https://github.com/jaredwray/qrbit/blob/main/LICENSE)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
