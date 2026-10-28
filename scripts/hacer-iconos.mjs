// Genera los iconos del sombrero de paja a partir de public/favicon.svg:  node scripts/hacer-iconos.mjs
import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync } from 'node:fs';
const svg = readFileSync('public/favicon.svg', 'utf8');
const b = await puppeteer.launch({ executablePath: process.env.BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const png = async (size) => { const p = await b.newPage(); await p.setViewport({ width: size, height: size, deviceScaleFactor: 1 }); await p.setContent(`<body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`); const buf = await p.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } }); await p.close(); return buf; };
const sizes = { 'apple-touch-icon.png': 180, 'icon-192.png': 192, 'icon-512.png': 512 }; for (const [f, s] of Object.entries(sizes)) writeFileSync('public/' + f, await png(s));
const ico = [await png(16), await png(32), await png(48)]; const dims = [16, 32, 48]; const head = Buffer.alloc(6 + 16 * 3); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(3, 4); let off = head.length;
ico.forEach((buf, k) => { const o = 6 + 16 * k; head[o] = dims[k]; head[o + 1] = dims[k]; head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6); head.writeUInt32LE(buf.length, o + 8); head.writeUInt32LE(off, o + 12); off += buf.length; });
writeFileSync('public/favicon.ico', Buffer.concat([head, ...ico])); await b.close(); setTimeout(() => process.exit(0), 300);
