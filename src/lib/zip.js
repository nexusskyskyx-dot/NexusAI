// ─────────────────────────────────────────────────────────────────────────────
// NexusAI · Minimal ZIP writer (store method, no compression, zero deps)
// Produces a real .zip the OS can open — used by the Projects exporter.
// ─────────────────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// files: [{ path: 'css/style.css', content: '…' }] → Blob
export function makeZip(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;

  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  for (const f of files) {
    if (!f.path || typeof f.content !== 'string') continue;
    const name = enc.encode(f.path);
    const data = enc.encode(f.content);
    const crc = crc32(data);

    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); // local file header signature
    lh.setUint16(4, 20, true); // version needed
    lh.setUint16(6, 0x0800, true); // flags: UTF-8 names
    lh.setUint16(8, 0, true); // method: store
    lh.setUint16(10, dosTime, true);
    lh.setUint16(12, dosDate, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); // compressed
    lh.setUint32(22, data.length, true); // uncompressed
    lh.setUint16(26, name.length, true);
    lh.setUint16(28, 0, true); // extra len
    chunks.push(new Uint8Array(lh.buffer), name, data);

    central.push({ name, data, crc, offset });
    offset += 30 + name.length + data.length;
  }

  const cdStart = offset;
  let cdSize = 0;
  for (const e of central) {
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); // central directory signature
    ch.setUint16(4, 20, true); // version made by
    ch.setUint16(6, 20, true); // version needed
    ch.setUint16(8, 0x0800, true); // flags: UTF-8
    ch.setUint16(10, 0, true); // method: store
    ch.setUint16(12, dosTime, true);
    ch.setUint16(14, dosDate, true);
    ch.setUint32(16, e.crc, true);
    ch.setUint32(20, e.data.length, true);
    ch.setUint32(24, e.data.length, true);
    ch.setUint16(28, e.name.length, true);
    ch.setUint32(42, e.offset, true); // relative offset of local header
    chunks.push(new Uint8Array(ch.buffer), e.name);
    cdSize += 46 + e.name.length;
  }

  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true); // end of central directory
  eocd.setUint16(8, central.length, true); // entries on this disk
  eocd.setUint16(10, central.length, true); // total entries
  eocd.setUint32(12, cdSize, true);
  eocd.setUint32(16, cdStart, true);
  chunks.push(new Uint8Array(eocd.buffer));

  return new Blob(chunks, { type: 'application/zip' });
}
