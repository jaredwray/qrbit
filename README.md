# QRBit

A fast QR code generator with logo embedding support, built with Rust and usable in Node.js via NAPI-RS.

## Features

- 🚀 **Fast**: Built with Rust for maximum performance
- 📱 **Cross-platform**: Works on iOS, Windows, Linux, and macOS
- 🖼️ **Logo embedding**: Add custom logos to your QR codes
- 🎨 **Customizable**: Custom colors, sizes, and margins
- 📋 **Multiple formats**: Generate SVG and PNG outputs
- 🔧 **TypeScript**: Full TypeScript support with type definitions
- 🧪 **Well-tested**: Comprehensive test coverage with Vitest

## Installation

```bash
pnpm add qrbit
# or
npm install qrbit
# or
yarn add qrbit
```

## Usage

### Basic Usage

```typescript
import { generateQr, generateSvg, generatePng, QrBit } from 'qrbit'

// Generate both SVG and PNG
const result = generateQr({ text: 'Hello World' })
console.log(result.svg) // SVG string
console.log(result.png) // PNG Buffer

// Generate only SVG
const svg = generateSvg('Hello World')

// Generate only PNG
const png = generatePng('Hello World')
```

### Advanced Usage with Options

```typescript
import { QrBit } from 'qrbit'

const qr = new QrBit({
  text: 'https://example.com',
  size: 300,
  margin: 20,
  backgroundColor: '#FFFFFF',
  foregroundColor: '#000000',
  logoPath: './logo.png',
  logoSizeRatio: 0.2
})

// Method chaining
const result = qr
  .setSize(400)
  .setMargin(30)
  .setColors('#FF0000', '#00FF00')
  .setLogo('./my-logo.png', 0.25)
  .generate()

// Generate specific formats
const svg = qr.generateSvg()
const png = qr.generatePng()
```

## API Reference

### Options

```typescript
interface QrOptions {
  text: string                 // Text to encode in QR code
  size?: number               // QR code size in pixels (default: 200)
  margin?: number             // Margin around QR code (default: 20)
  logoPath?: string           // Path to logo image file
  logoSizeRatio?: number      // Logo size as ratio of QR code size (default: 0.2)
  backgroundColor?: string    // Background color in #RRGGBB format (default: '#FFFFFF')
  foregroundColor?: string    // Foreground color in #RRGGBB format (default: '#000000')
}
```

### Result

```typescript
interface QrResult {
  svg?: string    // SVG string representation
  png?: Buffer    // PNG image buffer
  width: number   // Total width including margin
  height: number  // Total height including margin
}
```

### Functions

#### `generateQr(options: QrOptions): QrResult`

Generate both SVG and PNG output.

#### `generateSvg(text: string, options?: Omit<QrOptions, 'text'>): string`

Generate only SVG output.

#### `generatePng(text: string, options?: Omit<QrOptions, 'text'>): Buffer`

Generate only PNG output.

### QrBit Class

#### Constructor

```typescript
new QrBit(options: QrOptions)
```

#### Methods

- `generate(): QrResult` - Generate both SVG and PNG
- `generateSvg(): string` - Generate SVG only
- `generatePng(): Buffer` - Generate PNG only
- `setSize(size: number): QrBit` - Set QR code size (chainable)
- `setMargin(margin: number): QrBit` - Set margin size (chainable)
- `setLogo(logoPath: string, sizeRatio?: number): QrBit` - Set logo (chainable)
- `setColors(backgroundColor: string, foregroundColor: string): QrBit` - Set colors (chainable)

## Examples

### Save to File

```typescript
import { generateQr } from 'qrbit'
import { writeFileSync } from 'fs'

const result = generateQr({
  text: 'https://github.com/jaredwray/qrbit',
  size: 400,
  margin: 20
})

// Save SVG
writeFileSync('qrcode.svg', result.svg!)

// Save PNG
writeFileSync('qrcode.png', result.png!)
```

### With Custom Logo

```typescript
import { QrBit } from 'qrbit'

const qr = new QrBit({
  text: 'Visit our website!',
  size: 300,
  logoPath: './company-logo.png',
  logoSizeRatio: 0.15,
  backgroundColor: '#F0F0F0',
  foregroundColor: '#333333'
})

const png = qr.generatePng()
```

### URL QR Code

```typescript
import { generateSvg } from 'qrbit'

const svg = generateSvg('https://example.com', {
  size: 200,
  margin: 10,
  backgroundColor: '#000000',
  foregroundColor: '#FFFFFF'
})
```

## Performance

QRBit is built with Rust and uses NAPI-RS for Node.js bindings, providing excellent performance:

- Fast QR code generation
- Efficient image processing
- Low memory usage
- Native performance from Node.js

## Requirements

- Node.js >= 14
- Supported platforms: Windows, macOS, Linux (x64, ARM64)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
