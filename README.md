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
|  QRCode SVG (v1.5.4)               |    🥇     |       5K  |    214µs  |  ±0.50%  |       5K  |
|  QrBit SVG (Nodejs) (v0.1.0)       |  -0.15%   |       5K  |    214µs  |  ±0.50%  |       5K  |
|  QrBit PNG (Rust) (v0.1.0)         |   -69%    |       1K  |    686µs  |  ±0.52%  |       1K  |
|  QrBit SVG (Rust) (v0.1.0)         |   -84%    |     770   |      1ms  |  ±1.32%  |     742   |
|  QRCode PNG (v1.5.4)               |   -89%    |     534   |      2ms  |  ±1.63%  |     522   |
|  styled-qr-code-node SVG (v1.5.2)  |   -90%    |     465   |      2ms  |  ±1.22%  |     459   |
|  styled-qr-code-node (v1.5.2)      |   -96%    |     169   |      6ms  |  ±0.83%  |     169   |


## Logo Generation

|                name                |  summary  |  ops/sec  |  time/op  |  margin  |  samples  |
|------------------------------------|:---------:|----------:|----------:|:--------:|----------:|
|  QrBit PNG (v0.1.0)                |    🥇     |     944   |      1ms  |  ±0.42%  |     941   |
|  QrBit SVG (v0.1.0)                |   -24%    |     719   |      1ms  |  ±1.03%  |     702   |
|  styled-qr-code-node PNG (v1.5.2)  |   -88%    |     118   |      9ms  |  ±0.54%  |     118   |
|  styled-qr-code-node SVG (v1.5.2)  |   -89%    |     103   |     10ms  |  ±0.90%  |     103   |

## License and Copyright

[MIT & Copyright (c) Jared Wray](https://github.com/jaredwray/qrbit/blob/main/LICENSE)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
