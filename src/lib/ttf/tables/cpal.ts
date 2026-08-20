import ByteBuffer from 'microbuffer';
import type { Font } from '../../sfnt';

export default function createCPALTable(font: Font) {
  const palettes = font.colorFont!.palettes;
  const colorsPerPalette = palettes[0].length;
  const colorRecordsOffset = 12 + palettes.length * 2;
  const colorRecordCount = colorsPerPalette * palettes.length;
  const buffer = new ByteBuffer(colorRecordsOffset + colorRecordCount * 4);

  buffer.writeUint16(0); // version
  buffer.writeUint16(colorsPerPalette);
  buffer.writeUint16(palettes.length);
  buffer.writeUint16(colorRecordCount);
  buffer.writeUint32(colorRecordsOffset);

  palettes.forEach((_, paletteIndex) => {
    buffer.writeUint16(paletteIndex * colorsPerPalette);
  });

  palettes.forEach((palette) => {
    palette.forEach((color) => {
      buffer.writeUint8(color.blue);
      buffer.writeUint8(color.green);
      buffer.writeUint8(color.red);
      buffer.writeUint8(color.alpha);
    });
  });

  return buffer;
}
