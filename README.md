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

## SVG Generation (no logo)

|                  name                   |  summary  |  ops/sec  |  time/op  |  margin  |  samples  |
|-----------------------------------------|:---------:|----------:|----------:|:--------:|----------:|
|  QRCode toString (v1.5.4)               |    🥇     |       5K  |    205µs  |  ±0.45%  |       5K  |
|  QrBit toSvg (Native) (v0.1.0)          |   -4.4%   |       5K  |    221µs  |  ±0.92%  |       5K  |
|  QrBit toSvg (Rust) (v0.1.0)            |   -84%    |     787   |      1ms  |  ±1.29%  |     759   |
|  styled-qr-code-node toBuffer (v1.5.2)  |   -90%    |     475   |      2ms  |  ±1.32%  |     469   |

`Rust` is there for performance and when doing heavy image processing without needing node `canvas` installed. If you do not add a logo then the `Native` version is what you will get for SVG. 

## PNG Generation (no logo)

|                  name                   |  summary  |  ops/sec  |  time/op  |  margin  |  samples  |
|-----------------------------------------|:---------:|----------:|----------:|:--------:|----------:|
|  QrBit toPng (v0.1.0)                   |    🥇     |       2K  |    669µs  |  ±0.50%  |       1K  |
|  QRCode toBuffer (v1.5.4)               |   -64%    |     540   |      2ms  |  ±1.64%  |     528   |
|  styled-qr-code-node toBuffer (v1.5.2)  |   -89%    |     171   |      6ms  |  ±1.00%  |     171   |

`Rust` is used for `toPng()` to optimize performance for PNG generation and heavy image processing without needing node `canvas` installed.

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
