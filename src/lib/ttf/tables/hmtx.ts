import ByteBuffer from 'microbuffer';

export default function createHtmxTable(font: any) {
  const buf = new ByteBuffer(font.glyphs.length * 4);

  font.glyphs.forEach(function (glyph: any) {
    buf.writeUint16(glyph.width); //advanceWidth
    buf.writeInt16(glyph.xMin); //lsb
  });
  return buf;
}
