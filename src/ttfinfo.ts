#!/usr/bin/env node

/*
 * Internal utility qu quickly check ttf tables size
 */

import fs from 'fs';
import { format } from 'util';
import { ArgumentParser } from 'argparse';

const parser = new ArgumentParser({
  add_help: true,
  description: 'Dump TTF tables info'
});

parser.add_argument('infile', {
  nargs: 1,
  help: 'Input file'
});

parser.add_argument('-d', '--details', {
  help: 'Show table dump',
  action: 'store_true',
  required: false
});

const args = parser.parse_args();
let ttf: Buffer;

try {
  ttf = fs.readFileSync(args.infile[0]);
} catch {
  console.error("Can't open input file (%s)", args.infile[0]);
  process.exit(1);
}

const tablesCount = ttf.readUInt16BE(4);

let i, offset;
const headers: any[] = [];

for (i = 0; i < tablesCount; i++) {
  offset = 12 + i * 16;
  headers.push({
    name: String.fromCharCode(
      ttf.readUInt8(offset),
      ttf.readUInt8(offset + 1),
      ttf.readUInt8(offset + 2),
      ttf.readUInt8(offset + 3)
    ),
    offset: ttf.readUInt32BE(offset + 8),
    length: ttf.readUInt32BE(offset + 12)
  });
}

console.log(format('Tables count: %d'), tablesCount);

headers
  .sort((a, b) => a.offset - b.offset)
  .forEach(function (info) {
    console.log('- %s: %d bytes (%d offset)', info.name, info.length, info.offset);
    if (args.details) {
      const bufTable = ttf.subarray(info.offset, info.offset + info.length);
      const count = Math.floor(bufTable.length / 32);
      let off = 0;

      //split buffer to the small chunks to fit the screen
      for (let j = 0; j < count; j++) {
        console.log(bufTable.subarray(off, off + 32));
        off += 32;
      }

      //output the rest
      if (off < info.length) {
        console.log(bufTable.subarray(off, info.length));
      }

      console.log('');
    }
  });
