// Vercel Serverless Function entry point
// This file is NOT compiled by nest build — it's picked up directly by Vercel's runtime
const handler = require('../dist/src/vercel.js');
module.exports = handler.default || handler;
