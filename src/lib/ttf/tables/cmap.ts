import ByteBuffer from 'microbuffer';

function getIDByUnicode(font: any, unicode: number) {
  return font.codePoints[unicode] ? font.codePoints[unicode].id : 0;
}

// Calculate character segments with non-interruptable chains of unicodes
function getSegments(font: any, bounds?: number) {
  const limit = bounds || Number.MAX_VALUE;

  const result: any[] = [];
  let segment: any;

  // prevEndCode only changes when a segment closes
  Object.entries(font.codePoints).some(function ([unicodeStr]) {
    const unicode = parseInt(unicodeStr, 10);
    if (unicode >= limit) {
      return true;
    }
    // Initialize first segment or add new segment if code "hole" is found
    if (!segment || unicode !== segment.end + 1) {
      if (segment) {
        result.push(segment);
      }
      segment = {
        start: unicode
      };
    }
    segment.end = unicode;
    return false;
  });

  // Need to finish the last segment
  if (segment) {
    result.push(segment);
  }

  result.forEach(function (seg) {
    seg.length = seg.end - seg.start + 1;
  });

  return result;
}

// Returns an array of {unicode, glyph} sets for all valid code points up to bounds
function getCodePoints(codePoints: any, bounds?: number) {
  const limit = bounds || Number.MAX_VALUE;

  const result: any[] = [];

  Object.entries(codePoints).some(function ([unicodeStr, glyph]) {
    const unicode = parseInt(unicodeStr, 10);
    // Since this is a sparse array, iterating will only yield the valid code points
    if (unicode > limit) {
      return true;
    }
    result.push({
      unicode: unicode,
      glyph: glyph
    });
    return false;
  });
  return result;
}

function bufferForTable(format: number, length: number) {
  const fieldWidth = format === 8 || format === 10 || format === 12 || format === 13 ? 4 : 2;

  length +=
    0 +
    fieldWidth + // Format
    fieldWidth + // Length
    fieldWidth; // Language

  const LANGUAGE = 0;
  const buffer = new ByteBuffer(length);

  // Format specifier
  buffer.writeUint16(format);
  if (fieldWidth === 4) {
    // In case of formats 8.…, 10.…, 12.… and 13.…, this is the decimal part of the format number
    // But since have not been any point releases, this can be zero in that case as well
    buffer.writeUint16(0);
    buffer.writeUint32(length);
    buffer.writeUint32(LANGUAGE);
  } else {
    buffer.writeUint16(length);
    buffer.writeUint16(LANGUAGE);
  }

  return buffer;
}

function createFormat0Table(font: any) {
  const FORMAT = 0;

  let i;

  const length = 0xff + 1; //Format 0 maps only single-byte code points

  const buffer = bufferForTable(FORMAT, length);

  for (i = 0; i < length; i++) {
    buffer.writeUint8(getIDByUnicode(font, i)); // existing char in table 0..255
  }
  return buffer;
}

function createFormat4Table(font: any) {
  const FORMAT = 4;

  let i;

  const segments = getSegments(font, 0xffff);
  const glyphIndexArrays: number[][] = [];

  segments.forEach(function (segment) {
    const glyphIndexArray = [];

    for (let unicode = segment.start; unicode <= segment.end; unicode++) {
      glyphIndexArray.push(getIDByUnicode(font, unicode));
    }
    glyphIndexArrays.push(glyphIndexArray);
  });

  const segCount = segments.length + 1; // + 1 for the 0xFFFF section
  const glyphIndexArrayLength = glyphIndexArrays
    .map((a) => a.length)
    .reduce(function (result, count) {
      return result + count;
    }, 0);

  const length =
    0 +
    2 + // segCountX2
    2 + // searchRange
    2 + // entrySelector
    2 + // rangeShift
    2 * segCount + // endCodes
    2 + // Padding
    2 * segCount + //startCodes
    2 * segCount + //idDeltas
    2 * segCount + //idRangeOffsets
    2 * glyphIndexArrayLength;

  const buffer = bufferForTable(FORMAT, length);

  buffer.writeUint16(segCount * 2); // segCountX2
  const maxExponent = Math.floor(Math.log(segCount) / Math.LN2);
  const searchRange = 2 * Math.pow(2, maxExponent);

  buffer.writeUint16(searchRange); // searchRange
  buffer.writeUint16(maxExponent); // entrySelector
  buffer.writeUint16(2 * segCount - searchRange); // rangeShift

  // Array of end counts
  segments.forEach(function (segment) {
    buffer.writeUint16(segment.end);
  });
  buffer.writeUint16(0xffff); // endCountArray should be finished with 0xFFFF

  buffer.writeUint16(0); // reservedPad

  // Array of start counts
  segments.forEach(function (segment) {
    buffer.writeUint16(segment.start); //startCountArray
  });
  buffer.writeUint16(0xffff); // startCountArray should be finished with 0xFFFF

  // Array of deltas. Leave it zero to not complicate things when using the glyph index array
  for (i = 0; i < segments.length; i++) {
    buffer.writeUint16(0); // delta is always zero because we use the glyph array
  }
  buffer.writeUint16(1); // idDeltaArray should be finished with 1

  // Array of range offsets
  let offset = 0;

  for (i = 0; i < segments.length; i++) {
    buffer.writeUint16(2 * (segments.length - i + 1 + offset));
    offset += glyphIndexArrays[i].length;
  }
  buffer.writeUint16(0); // rangeOffsetArray should be finished with 0

  glyphIndexArrays.forEach(function (glyphIndexArray) {
    glyphIndexArray.forEach(function (glyphId) {
      buffer.writeUint16(glyphId);
    });
  });

  return buffer;
}

function createFormat12Table(font: any) {
  const FORMAT = 12;

  const codePoints = getCodePoints(font.codePoints);

  const length =
    0 +
    4 + // nGroups
    4 * codePoints.length + // startCharCode
    4 * codePoints.length + // endCharCode
    4 * codePoints.length; // startGlyphCode

  const buffer = bufferForTable(FORMAT, length);

  buffer.writeUint32(codePoints.length); // nGroups
  codePoints.forEach(function (codePoint) {
    buffer.writeUint32(codePoint.unicode); // startCharCode
    buffer.writeUint32(codePoint.unicode); // endCharCode
    buffer.writeUint32(codePoint.glyph.id); // startGlyphCode
  });

  return buffer;
}

export default function createCMapTable(font: any) {
  const TABLE_HEAD =
    0 +
    2 + // platform
    2 + // encoding
    4; // offset

  const singleByteTable: any = createFormat0Table(font);
  const twoByteTable: any = createFormat4Table(font);
  const fourByteTable: any = createFormat12Table(font);

  // Subtable headers must be sorted by platformID, encodingID
  const tableHeaders = [
    // subtable 4, unicode
    {
      platformID: 0,
      encodingID: 3,
      table: twoByteTable
    },
    // subtable 12, unicode
    {
      platformID: 0,
      encodingID: 4,
      table: fourByteTable
    },
    // subtable 0, mac standard
    {
      platformID: 1,
      encodingID: 0,
      table: singleByteTable
    },
    // subtable 4, windows standard, identical to the unicode table
    {
      platformID: 3,
      encodingID: 1,
      table: twoByteTable
    },
    // subtable 12, windows ucs4
    {
      platformID: 3,
      encodingID: 10,
      table: fourByteTable
    }
  ];

  const tables = [twoByteTable, singleByteTable, fourByteTable];

  let tableOffset =
    0 +
    2 + // version
    2 + // number of subtable headers
    tableHeaders.length * TABLE_HEAD;

  // Calculate offsets for each table
  tables.forEach(function (table: any) {
    table._tableOffset = tableOffset;
    tableOffset += table.length;
  });

  const length = tableOffset;

  const buffer = new ByteBuffer(length);

  // Write table header.
  buffer.writeUint16(0); // version
  buffer.writeUint16(tableHeaders.length); // count

  // Write subtable headers
  tableHeaders.forEach(function (header) {
    buffer.writeUint16(header.platformID); // platform
    buffer.writeUint16(header.encodingID); // encoding
    buffer.writeUint32(header.table._tableOffset); // offset
  });

  // Write subtables
  tables.forEach(function (table: any) {
    buffer.writeBytes(table.buffer);
  });

  return buffer;
}
