# QrBit Examples

This directory contains 10 curated examples showcasing QrBit's key features.

## Examples Generated

1. **01_basic.png** - Simple "Hello World!" QR code
2. **02_url.svg** - GitHub repository URL in SVG format  
3. **03_large_size.png** - Large 400px QR code
4. **04_inverted.svg** - White on black (inverted colors)
5. **05_red_theme.png** - Red background theme
6. **06_logo_small.png** - QR code with small logo (20%)
7. **07_logo_large_red.svg** - QR code with large logo (40%) and red theme
8. **08_wifi.png** - WiFi connection QR code
9. **09_large_margin_blue.svg** - Large QR with custom margin and blue theme  
10. **10_buffer_logo.png** - QR code using logo from Buffer (not file path)

## Key Features Demonstrated

- 📝 **Multiple formats**: Both PNG and SVG output
- 📏 **Size control**: From default 200px to large 400px
- 🎨 **Color themes**: Classic, inverted, and custom colors
- 🖼️  **Logo embedding**: File path and Buffer-based logos
- 📐 **Margin control**: Various spacing options
- 🔗 **Content types**: Text, URLs, WiFi credentials

## Usage

```typescript
import { QrBit } from "qrbit";

// Basic usage
const qr = new QrBit({ text: "Hello World!" });
await qr.toPngFile("output.png");

// With logo and custom colors  
const qrWithLogo = new QrBit({
    text: "https://github.com/jaredwray/qrbit",
    logo: "./logo.png",
    backgroundColor: "#FF0000", 
    foregroundColor: "#FFFFFF",
    logoSizeRatio: 0.2
});

await qrWithLogo.toSvgFile("output.svg");
```

Generated with QrBit v0.1.0
