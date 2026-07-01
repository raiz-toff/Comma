const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "../node_modules/sql.js/dist/sql-wasm.wasm");
const dest = path.join(__dirname, "../public/sql-wasm.wasm");

if (fs.existsSync(src)) {
  fs.copyFileSync(src, dest);
  console.log("Copied sql-wasm.wasm to public/");
} else {
  console.warn("sql-wasm.wasm not found — skipping copy");
}
