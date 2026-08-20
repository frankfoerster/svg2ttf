import ByteBuffer from 'microbuffer';
import type { Font } from '../../sfnt';

export default function createCOLRTable(font: Font) {
  const colorFont = font.colorFont!;
  const baseGlyphRecordOffset = 14;
  const layerRecordOffset = baseGlyphRecordOffset + colorFont.baseGlyphs.length * 6;
  const layerCount = colorFont.baseGlyphs.reduce((count, baseGlyph) => {
    return count + baseGlyph.layers.length;
  }, 0);
  const buffer = new ByteBuffer(layerRecordOffset + layerCount * 4);

  buffer.writeUint16(0); // version
  buffer.writeUint16(colorFont.baseGlyphs.length);
  buffer.writeUint32(baseGlyphRecordOffset);
  buffer.writeUint32(layerRecordOffset);
  buffer.writeUint16(layerCount);

  let firstLayerIndex = 0;
  colorFont.baseGlyphs.forEach((baseGlyph) => {
    buffer.writeUint16(baseGlyph.glyphID);
    buffer.writeUint16(firstLayerIndex);
    buffer.writeUint16(baseGlyph.layers.length);
    firstLayerIndex += baseGlyph.layers.length;
  });

  colorFont.baseGlyphs.forEach((baseGlyph) => {
    baseGlyph.layers.forEach((layer) => {
      buffer.writeUint16(layer.glyphID);
      buffer.writeUint16(layer.paletteIndex);
    });
  });

  return buffer;
}
