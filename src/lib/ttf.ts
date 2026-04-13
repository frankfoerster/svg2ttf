import ByteBuffer from 'microbuffer';

import createGSUBTable from './ttf/tables/gsub';
import createOS2Table from './ttf/tables/os2';
import createCMapTable from './ttf/tables/cmap';
import createGlyfTable from './ttf/tables/glyf';
import createHeadTable from './ttf/tables/head';
import createHHeadTable from './ttf/tables/hhea';
import createHtmxTable from './ttf/tables/hmtx';
import createLocaTable from './ttf/tables/loca';
import createMaxpTable from './ttf/tables/maxp';
import createNameTable from './ttf/tables/name';
import createPostTable from './ttf/tables/post';

import * as utils from './ttf/utils';

// Tables
const TABLES = [
  { innerName: 'GSUB', order: 4, create: createGSUBTable }, // GSUB
  { innerName: 'OS/2', order: 4, create: createOS2Table }, // OS/2
  { innerName: 'cmap', order: 6, create: createCMapTable }, // cmap
  { innerName: 'glyf', order: 8, create: createGlyfTable }, // glyf
  { innerName: 'head', order: 2, create: createHeadTable }, // head
  { innerName: 'hhea', order: 1, create: createHHeadTable }, // hhea
  { innerName: 'hmtx', order: 5, create: createHtmxTable }, // hmtx
  { innerName: 'loca', order: 7, create: createLocaTable }, // loca
  { innerName: 'maxp', order: 3, create: createMaxpTable }, // maxp
  { innerName: 'name', order: 9, create: createNameTable }, // name
  { innerName: 'post', order: 10, create: createPostTable } // post
];

// Various constants
const CONST = {
  VERSION: 0x10000,
  CHECKSUM_ADJUSTMENT: 0xb1b0afba
};

function ulong(t: number): number {
  t &= 0xffffffff;
  if (t < 0) {
    t += 0x100000000;
  }
  return t;
}

function calc_checksum(buf: any): number {
  let sum = 0;
  const nlongs = Math.floor(buf.length / 4);
  let i;

  for (i = 0; i < nlongs; ++i) {
    const t = buf.getUint32(i * 4);

    sum = ulong(sum + t);
  }

  const leftBytes = buf.length - nlongs * 4; //extra 1..3 bytes found, because table is not aligned. Need to include them in checksum too.

  if (leftBytes > 0) {
    let leftRes = 0;

    for (i = 0; i < 4; i++) {
      leftRes = (leftRes << 8) + (i < leftBytes ? buf.getUint8(nlongs * 4 + i) : 0);
    }
    sum = ulong(sum + leftRes);
  }
  return sum;
}

export default function generateTTF(font: any) {
  // Prepare TTF contours objects. Note, that while sfnt countours are classes,
  // ttf contours are just plain arrays of points
  font.glyphs.forEach(function (glyph: any) {
    glyph.ttfContours = glyph.contours.map(function (contour: any) {
      return contour.points;
    });
  });

  // Process ttf contours data
  font.glyphs.forEach(function (glyph: any) {
    // 0.3px accuracy is ok. fo 1000x1000.
    glyph.ttfContours = utils.simplify(glyph.ttfContours, 0.3);
    glyph.ttfContours = utils.simplify(glyph.ttfContours, 0.3); // one pass is not enougth

    // Interpolated points can be removed. 1.1px is acceptable
    // measure - it will give us 1px error after coordinates rounding.
    glyph.ttfContours = utils.interpolate(glyph.ttfContours, 1.1);

    glyph.ttfContours = utils.roundPoints(glyph.ttfContours);
    glyph.ttfContours = utils.removeClosingReturnPoints(glyph.ttfContours);
    glyph.ttfContours = utils.toRelative(glyph.ttfContours);
  });

  // Add tables
  const headerSize = 12 + 16 * TABLES.length; // TTF header plus table headers
  let bufSize = headerSize;

  TABLES.forEach(function (table: any) {
    //store each table in its own buffer
    table.buffer = table.create(font);
    table.length = table.buffer.length;
    table.corLength = table.length + ((4 - (table.length % 4)) % 4); // table size should be divisible to 4
    table.checkSum = calc_checksum(table.buffer);
    bufSize += table.corLength;
  });

  //calculate offsets
  let offset = headerSize;

  [...TABLES]
    .sort((a: any, b: any) => a.order - b.order)
    .forEach(function (table: any) {
      table.offset = offset;
      offset += table.corLength;
    });

  //create TTF buffer

  const buf = new ByteBuffer(bufSize);

  //special constants
  const entrySelector = Math.floor(Math.log(TABLES.length) / Math.LN2);
  const searchRange = Math.pow(2, entrySelector) * 16;
  const rangeShift = TABLES.length * 16 - searchRange;

  // Add TTF header
  buf.writeUint32(CONST.VERSION);
  buf.writeUint16(TABLES.length);
  buf.writeUint16(searchRange);
  buf.writeUint16(entrySelector);
  buf.writeUint16(rangeShift);

  TABLES.forEach(function (table: any) {
    buf.writeUint32(utils.identifier(table.innerName)); //inner name
    buf.writeUint32(table.checkSum); //checksum
    buf.writeUint32(table.offset); //offset
    buf.writeUint32(table.length); //length
  });

  let headOffset = 0;

  [...TABLES]
    .sort((a: any, b: any) => a.order - b.order)
    .forEach(function (table: any) {
      if (table.innerName === 'head') {
        //we must store head offset to write font checksum
        headOffset = buf.tell();
      }
      buf.writeBytes(table.buffer.buffer);
      for (let i = table.length; i < table.corLength; i++) {
        //align table to be divisible to 4
        buf.writeUint8(0);
      }
    });

  // Write font checksum (corrected by magic value) into HEAD table
  buf.setUint32(headOffset + 8, ulong(CONST.CHECKSUM_ADJUSTMENT - calc_checksum(buf)));

  return buf;
}
