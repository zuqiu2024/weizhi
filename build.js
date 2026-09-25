#!/usr/bin/env node
// build.js — 将 index.html 和 admin.html 内嵌进 worker.js
// 运行: node build.js

const fs = require('fs');
const path = require('path');

const workerTemplate = fs.readFileSync(path.join(__dirname, 'worker.js'), 'utf-8');
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
const adminHtml = fs.readFileSync(path.join(__dirname, 'admin.html'), 'utf-8');

// 转义反引号和 ${ 以免破坏模板字符串
const escapeTemplate = (str) => str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

let output = workerTemplate
  .replace('`__INDEX_HTML__`', '`' + escapeTemplate(indexHtml) + '`')
  .replace('`__ADMIN_HTML__`', '`' + escapeTemplate(adminHtml) + '`');

// 确保 src 目录存在
if (!fs.existsSync('src')) fs.mkdirSync('src');
fs.writeFileSync(path.join(__dirname, 'src', 'worker.js'), output, 'utf-8');

console.log('✅ Build complete → src/worker.js');
console.log(`   index.html: ${indexHtml.length} chars`);
console.log(`   admin.html: ${adminHtml.length} chars`);
