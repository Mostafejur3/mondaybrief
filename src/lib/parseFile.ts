"use client";
import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface ParsedFile { rows: Record<string, string>[]; columns: string[]; sheets: string[]; format: string; }

function cleanRows(rows: any[]): Record<string, string>[] {
  return rows.filter((r) => r && Object.values(r).some((v) => v !== null && v !== undefined && String(v).trim() !== "") || r)
    .map((r) => { const o: Record<string, string> = {}; for (const [k, v] of Object.entries(r || {})) { const key = String(k).trim() === "" ? "Column" : String(k); o[key] = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v); } return o; });
}

export async function listSheets(file: File): Promise<string[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    return wb.SheetNames;
  }
  return [];
}

export async function parseFile(file: File, sheetName?: string): Promise<ParsedFile> {
  const name = file.name.toLowerCase();
  if (/\.(exe|bat|sh|msi|jar|com|dll)$/.test(name)) throw new Error("Executable files are rejected for security reasons.");
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const sheet = sheetName && wb.SheetNames.includes(sheetName) ? sheetName : wb.SheetNames[0];
    const json = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: "", raw: true });
    const rows = cleanRows(json as any[]);
    return { rows, columns: rows[0] ? Object.keys(rows[0]) : [], sheets: wb.SheetNames, format: name.endsWith(".xls") ? "xls" : "xlsx" };
  }
  if (name.endsWith(".json")) {
    const text = await file.text();
    let parsed: any; try { parsed = JSON.parse(text); } catch { throw new Error("This JSON file could not be parsed."); }
    const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed.data) ? parsed.data : [parsed];
    if (!arr.length || typeof arr[0] !== "object") throw new Error("JSON must be an array of objects (one object per row).");
    const rows = cleanRows(arr);
    return { rows, columns: rows[0] ? Object.keys(rows[0]) : [], sheets: [], format: "json" };
  }
  if (/\.(csv|tsv|txt)$/.test(name)) {
    const text = await file.text();
    const result = Papa.parse(text, { header: true, skipEmptyLines: "greedy", delimiter: name.endsWith(".tsv") ? "\t" : "" });
    if (result.errors?.length && !result.data?.length) throw new Error(`CSV parse error: ${result.errors[0].message}`);
    const rows = cleanRows(result.data as any[]);
    return { rows, columns: (result.meta.fields || []).filter(Boolean) as string[], sheets: [], format: name.split(".").pop() || "csv" };
  }
  throw new Error("Unsupported format. Supported dataset formats: CSV, TSV, TXT (delimited), JSON, XLSX, XLS. PDF/DOCX are documents, not tabular datasets, and are not imported as data.");
}
