import React, { useState } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import Papa from "papaparse";
import { Text } from "../ui/text";
import { CurrencyText } from "../ui/CurrencyText";
import { PlatformBadge } from "../ui/PlatformBadge";
import { insertManyShifts } from "../../database/queries/shifts";
import { notifyImport } from "../../services/notify";
import { PLATFORM_REGISTRY } from "../../registry/platforms";
import { usePlatformTheme } from "../../hooks/usePlatformTheme";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";

const isWeb = Platform.OS === "web";

interface Mapping {
  platform: string;
  startTime: string;
  endTime: string;
  grossRevenue: string;
  tipsRevenue: string;
  activeMileage: string;
  deadMileage: string;
}

interface ParsedShift {
  id: string;
  vehicleId: null;
  platform: string;
  startTime: Date;
  endTime: Date;
  grossRevenue: number;
  tipsRevenue: number;
  trackedMileage: number;
  activeMileage: number;
  deadMileage: number;
  durationSeconds: number;
  pausedSeconds: number;
  notes: string;
}

// ── Validation / parsing helpers ─────────────────────────────────────────────

/**
 * Ordered platform alias table. More specific entries (e.g. "uber eats") must
 * appear before broader ones (e.g. "uber") so the first match wins.
 */
const PLATFORM_ALIASES: Array<{ id: string; patterns: string[] }> = [
  { id: "ubereats", patterns: ["ubereats", "ubereat", "uber eats", "eats"] },
  { id: "doordash", patterns: ["doordash", "dasher", "dash", "dd"] },
  { id: "skip", patterns: ["skipthedishes", "skip"] },
  { id: "instacart", patterns: ["instacart"] },
  { id: "lyft", patterns: ["lyft"] },
  { id: "amazonflex", patterns: ["amazonflex", "amazon flex", "amazon", "flex"] },
  { id: "foodora", patterns: ["foodora"] },
  { id: "deliveroo", patterns: ["deliveroo"] },
  { id: "stuart", patterns: ["stuart"] },
  { id: "uber", patterns: ["uber"] },
];

/** Maps a raw CSV platform string to a known registry id, defaulting to "other". */
function matchPlatform(raw: any): string {
  const norm = String(raw ?? "").toLowerCase().trim();
  if (!norm) return "other";

  // Exact registry id match (e.g. CSV exported from this app).
  if (PLATFORM_REGISTRY[norm]) return norm;

  for (const entry of PLATFORM_ALIASES) {
    if (entry.patterns.some((p) => norm.includes(p))) return entry.id;
  }

  // Fall back to matching against registry labels / short labels.
  for (const [id, def] of Object.entries(PLATFORM_REGISTRY)) {
    if (
      norm === def.label.toLowerCase() ||
      (def.shortLabel && norm === def.shortLabel.toLowerCase())
    ) {
      return id;
    }
  }

  return "other";
}

/**
 * Tolerant date parser. Handles ISO 8601, epoch (s/ms), native-parseable
 * strings, and common M/D/Y or D/M/Y formats with optional 12/24h time.
 */
function parseFlexibleDate(value: any): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  const s = String(value).trim();
  if (!s) return null;

  // Pure epoch timestamps.
  if (/^\d{10}$/.test(s)) return new Date(parseInt(s, 10) * 1000);
  if (/^\d{13}$/.test(s)) return new Date(parseInt(s, 10));

  // Native parsing covers ISO 8601 and many locale strings.
  const native = new Date(s);
  if (!isNaN(native.getTime())) return native;

  // Manual slash/dash/dot dates: M/D/Y or D/M/Y, optional time + AM/PM.
  const m = s.match(
    /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?$/
  );
  if (m) {
    const [, aStr, bStr, yStr, hhStr, mmStr, ssStr, ap] = m;
    let year = parseInt(yStr, 10);
    if (year < 100) year += 2000;

    const first = parseInt(aStr, 10);
    const second = parseInt(bStr, 10);
    // If the first field can't be a month, assume day-first ordering.
    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second;

    let hours = hhStr ? parseInt(hhStr, 10) : 0;
    const mins = mmStr ? parseInt(mmStr, 10) : 0;
    const secs = ssStr ? parseInt(ssStr, 10) : 0;
    if (ap) {
      const isPm = ap.toLowerCase() === "pm";
      if (isPm && hours < 12) hours += 12;
      if (!isPm && hours === 12) hours = 0;
    }

    const d = new Date(year, month - 1, day, hours, mins, secs);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/** Parses a numeric value, stripping currency symbols/commas. */
function parseNumber(value: any): number {
  if (value == null) return 0;
  const n = parseFloat(String(value).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
}

export function CSVImportWizard() {
  const queryClient = useQueryClient();
  const { accentColor, accentColorDim, accentColorContrast } = usePlatformTheme();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [fileName, setFileName] = useState("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Column mapping state
  const [mapping, setMapping] = useState<Mapping>({
    platform: "",
    startTime: "",
    endTime: "",
    grossRevenue: "",
    tipsRevenue: "",
    activeMileage: "",
    deadMileage: "",
  });

  // Validation results
  const [validRows, setValidRows] = useState<ParsedShift[]>([]);
  const [skipReasons, setSkipReasons] = useState<Record<string, number>>({});
  const [invalidRowCount, setInvalidRowCount] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; skipped: number } | null>(null);

  // ── Step 1: Pick document & parse headers ──────────────────────────────────
  const pickCSV = async () => {
    setErrorMessage("");
    try {
      setIsParsing(true);
      const res = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values", "application/csv", "text/plain"],
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) {
        setIsParsing(false);
        return;
      }

      const asset = res.assets[0];
      setFileName(asset.name);

      let csvText = "";
      if (isWeb && asset.file) {
        csvText = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve((e.target?.result as string) || "");
          reader.onerror = (err) => reject(err);
          reader.readAsText(asset.file!);
        });
      } else {
        csvText = await FileSystem.readAsStringAsync(asset.uri);
      }

      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
        complete: (results) => {
          setIsParsing(false);

          const fields = results.meta?.fields?.filter((f) => f && f.trim().length > 0) ?? [];
          if (fields.length === 0) {
            setErrorMessage("CSV file must contain a header row with column names.");
            return;
          }
          if (!results.data || results.data.length === 0) {
            setErrorMessage("No data rows were found in this CSV file.");
            return;
          }

          setCsvHeaders(fields);
          setCsvRows(results.data as any[]);
          setMapping(autoMap(fields));
          setStep(2);
        },
        error: (err: any) => {
          setIsParsing(false);
          setErrorMessage(`Could not parse CSV: ${err?.message || "unknown error"}`);
        },
      });
    } catch (err: any) {
      setIsParsing(false);
      setErrorMessage(`Failed to read file: ${err?.message || err}`);
    }
  };

  /** Best-effort auto-mapping of CSV headers to required fields. */
  const autoMap = (fields: string[]): Mapping => {
    const map: Mapping = {
      platform: "",
      startTime: "",
      endTime: "",
      grossRevenue: "",
      tipsRevenue: "",
      activeMileage: "",
      deadMileage: "",
    };

    const find = (test: (l: string) => boolean) => fields.find((f) => test(f.toLowerCase())) || "";

    map.platform = find((l) => l.includes("platform") || l.includes("app") || l.includes("service") || l.includes("gig"));
    // Prefer explicit start/end, then fall back to a generic date column for start.
    map.startTime =
      find((l) => l.includes("start") || l.includes("begin")) ||
      find((l) => l.includes("date") && !l.includes("end"));
    map.endTime = find((l) => l.includes("end") || l.includes("finish") || l.includes("stop"));
    map.tipsRevenue = find((l) => l.includes("tip"));
    map.grossRevenue = find(
      (l) =>
        !l.includes("tip") &&
        (l.includes("gross") || l.includes("earning") || l.includes("payout") || l.includes("revenue") || l.includes("pay") || l.includes("total"))
    );
    map.deadMileage = find((l) => l.includes("dead") || l.includes("untracked") || l.includes("commute"));
    map.activeMileage = find(
      (l) => l !== map.deadMileage.toLowerCase() && (l.includes("active") || l.includes("mile") || l.includes("dist") || l.includes("km"))
    );

    return map;
  };

  // ── Step 2: Validate mapping & parse rows ──────────────────────────────────
  const processMapping = () => {
    setErrorMessage("");
    if (!mapping.platform || !mapping.startTime || !mapping.endTime) {
      setErrorMessage("Platform, Start, and End columns are required to import shifts.");
      return;
    }

    const parsed: ParsedShift[] = [];
    const reasons: Record<string, number> = {};
    let invalid = 0;
    const stamp = Date.now();

    const addReason = (reason: string) => {
      reasons[reason] = (reasons[reason] || 0) + 1;
      invalid++;
    };

    csvRows.forEach((row, index) => {
      const start = parseFlexibleDate(row[mapping.startTime]);
      if (!start) {
        addReason("Unreadable start date");
        return;
      }
      const end = parseFlexibleDate(row[mapping.endTime]);
      if (!end) {
        addReason("Unreadable end date");
        return;
      }
      if (end.getTime() < start.getTime()) {
        addReason("End is before start");
        return;
      }

      const gross = Math.max(0, parseNumber(mapping.grossRevenue ? row[mapping.grossRevenue] : 0));
      const tips = Math.max(0, parseNumber(mapping.tipsRevenue ? row[mapping.tipsRevenue] : 0));
      const active = Math.max(0, parseNumber(mapping.activeMileage ? row[mapping.activeMileage] : 0));
      const dead = Math.max(0, parseNumber(mapping.deadMileage ? row[mapping.deadMileage] : 0));
      const durationSeconds = Math.floor((end.getTime() - start.getTime()) / 1000);

      parsed.push({
        id: `shift_import_${stamp}_${index}`,
        vehicleId: null,
        platform: matchPlatform(row[mapping.platform]),
        startTime: start,
        endTime: end,
        grossRevenue: gross,
        tipsRevenue: tips,
        trackedMileage: active,
        activeMileage: active,
        deadMileage: dead,
        durationSeconds,
        pausedSeconds: 0,
        notes: `Imported from ${fileName}`,
      });
    });

    if (parsed.length === 0) {
      setErrorMessage("No valid rows could be parsed. Check your column mapping and date formats.");
    }

    setValidRows(parsed);
    setSkipReasons(reasons);
    setInvalidRowCount(invalid);
    setStep(3);
  };

  // ── Step 3: Execute import ─────────────────────────────────────────────────
  const executeImport = async () => {
    if (validRows.length === 0) {
      setErrorMessage("There are no valid rows to import.");
      return;
    }

    setErrorMessage("");
    setIsImporting(true);
    try {
      const res = await insertManyShifts(validRows);
      setImportResult({ success: res.successCount, skipped: res.skippedCount + invalidRowCount });

      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });

      if (res.successCount > 0) notifyImport(res.successCount);

      setStep(4);
    } catch (err: any) {
      setErrorMessage(err?.message || "Database insert failed.");
    } finally {
      setIsImporting(false);
    }
  };

  const reasonEntries = Object.entries(skipReasons);

  return (
    <ScrollView contentContainerClassName="flex flex-col gap-5 pb-8">
      {/* Step progress */}
      <View className="flex-row items-center justify-between bg-[#0d0d0d] p-4 border border-[#1f1f1f] rounded-2xl">
        {[1, 2, 3, 4].map((num) => {
          const reached = step >= num;
          return (
            <View key={num} className="flex-row items-center flex-1 justify-center">
              <View
                className="w-7 h-7 rounded-full items-center justify-center border-2"
                style={{
                  borderColor: reached ? accentColor : "#27272a",
                  backgroundColor: step > num ? accentColor : reached ? accentColorDim : "#000000",
                }}
              >
                <Text
                  className="text-xs font-bold"
                  style={{ color: step > num ? accentColorContrast : reached ? accentColor : "#52525b" }}
                >
                  {num}
                </Text>
              </View>
              {num < 4 && (
                <View className="h-0.5 flex-1 mx-2" style={{ backgroundColor: step > num ? accentColor : "#1f1f1f" }} />
              )}
            </View>
          );
        })}
      </View>

      {errorMessage ? (
        <View className="bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-xl">
          <Text className="text-rose-400 text-xs font-semibold">{errorMessage}</Text>
        </View>
      ) : null}

      {/* STEP 1: UPLOAD */}
      {step === 1 && (
        <View className="bg-[#0d0d0d] border border-[#1f1f1f] rounded-2xl p-5 flex flex-col gap-4 items-center justify-center py-10">
          <View
            className="w-14 h-14 rounded-2xl items-center justify-center border"
            style={{ backgroundColor: accentColorDim, borderColor: accentColor }}
          >
            <Text className="text-[11px] font-extrabold tracking-widest" style={{ color: accentColor }}>
              CSV
            </Text>
          </View>
          <Text className="text-white font-bold text-base tracking-tight mt-2">Upload CSV File</Text>
          <Text className="text-zinc-500 text-xs text-center px-4 leading-relaxed font-medium">
            Select a CSV export from your gig platform. The file must include a header row with column names.
          </Text>

          {isParsing ? (
            <ActivityIndicator size="small" color={accentColor} className="mt-4" />
          ) : (
            <TouchableOpacity
              onPress={pickCSV}
              style={{ backgroundColor: accentColor }}
              className="mt-6 px-6 py-3.5 rounded-xl"
            >
              <Text style={{ color: accentColorContrast }} className="text-xs font-bold uppercase tracking-wider">
                Choose CSV Document
              </Text>
            </TouchableOpacity>
          )}

          <View className="w-full mt-4 bg-[#000000] border border-[#1f1f1f] rounded-xl p-3.5">
            <Text className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-1">Expected columns</Text>
            <Text className="text-zinc-400 text-[11px] font-medium leading-relaxed">
              Platform, Start date/time, End date/time, Gross earnings, Tips, Active distance, Dead distance.
              You map them on the next step.
            </Text>
          </View>
        </View>
      )}

      {/* STEP 2: COLUMN MAPPING */}
      {step === 2 && (
        <View className="bg-[#0d0d0d] border border-[#1f1f1f] rounded-2xl p-5 flex flex-col gap-4">
          <View className="flex-col gap-1 mb-1">
            <Text className="text-white font-bold text-sm tracking-tight">Map CSV Columns</Text>
            <Text className="text-zinc-500 text-xs font-medium">
              Link your CSV columns to shift fields. Fields marked * are required.
            </Text>
          </View>

          <ColumnSelect label="Gig Platform *" headers={csvHeaders} value={mapping.platform} accentColor={accentColor} onChange={(v) => setMapping((m) => ({ ...m, platform: v }))} />
          <ColumnSelect label="Start Date/Time *" headers={csvHeaders} value={mapping.startTime} accentColor={accentColor} onChange={(v) => setMapping((m) => ({ ...m, startTime: v }))} />
          <ColumnSelect label="End Date/Time *" headers={csvHeaders} value={mapping.endTime} accentColor={accentColor} onChange={(v) => setMapping((m) => ({ ...m, endTime: v }))} />
          <ColumnSelect label="Gross Earnings" headers={csvHeaders} value={mapping.grossRevenue} accentColor={accentColor} onChange={(v) => setMapping((m) => ({ ...m, grossRevenue: v }))} />
          <ColumnSelect label="Tips" headers={csvHeaders} value={mapping.tipsRevenue} accentColor={accentColor} onChange={(v) => setMapping((m) => ({ ...m, tipsRevenue: v }))} />
          <ColumnSelect label="Active Distance" headers={csvHeaders} value={mapping.activeMileage} accentColor={accentColor} onChange={(v) => setMapping((m) => ({ ...m, activeMileage: v }))} />
          <ColumnSelect label="Dead Distance" headers={csvHeaders} value={mapping.deadMileage} accentColor={accentColor} onChange={(v) => setMapping((m) => ({ ...m, deadMileage: v }))} />

          <View className="flex-row gap-3 mt-3">
            <TouchableOpacity onPress={() => { setErrorMessage(""); setStep(1); }} className="flex-1 py-3.5 bg-[#1f1f1f] border border-[#27272a] rounded-xl items-center">
              <Text className="text-zinc-300 text-xs font-bold uppercase tracking-wider">Back</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={processMapping} style={{ backgroundColor: accentColor }} className="flex-1 py-3.5 rounded-xl items-center">
              <Text style={{ color: accentColorContrast }} className="text-xs font-bold uppercase tracking-wider">Preview</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* STEP 3: PREVIEW */}
      {step === 3 && (
        <View className="bg-[#0d0d0d] border border-[#1f1f1f] rounded-2xl p-5 flex flex-col gap-4">
          <View className="flex-col gap-1 mb-1">
            <Text className="text-white font-bold text-sm tracking-tight">Data Preview</Text>
            <Text className="text-zinc-500 text-xs font-medium">Review parsed shifts before importing.</Text>
          </View>

          <View className="flex-row justify-between bg-[#000000] p-3 rounded-xl border border-[#1f1f1f]">
            <View className="items-center flex-1 border-r border-[#1f1f1f]">
              <Text className="text-base font-extrabold" style={{ color: accentColor }}>{validRows.length}</Text>
              <Text className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">Valid Shifts</Text>
            </View>
            <View className="items-center flex-1">
              <Text className="text-base font-extrabold text-rose-400">{invalidRowCount}</Text>
              <Text className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">Skipped Rows</Text>
            </View>
          </View>

          {reasonEntries.length > 0 && (
            <View className="bg-[#000000] border border-[#1f1f1f] rounded-xl p-3 flex flex-col gap-1.5">
              <Text className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Why rows were skipped</Text>
              {reasonEntries.map(([reason, count]) => (
                <View key={reason} className="flex-row justify-between items-center">
                  <Text className="text-zinc-400 text-[11px] font-medium">{reason}</Text>
                  <Text className="text-rose-400 text-[11px] font-bold">{count}</Text>
                </View>
              ))}
            </View>
          )}

          {validRows.length > 0 && (
            <>
              <Text className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pl-1 mt-1">First 5 Sample Records</Text>
              <View className="flex flex-col gap-2">
                {validRows.slice(0, 5).map((row) => (
                  <View key={row.id} className="bg-[#000000] border border-[#1f1f1f] p-3 rounded-xl flex-row justify-between items-center">
                    <View className="flex-col gap-1.5 flex-1 pr-2">
                      <PlatformBadge platform={row.platform} size="sm" />
                      <Text className="text-[11px] text-zinc-300 font-medium">
                        {row.startTime.toLocaleDateString(undefined, { dateStyle: "medium" })}
                      </Text>
                      <Text className="text-[10px] text-zinc-500 font-medium">
                        {(row.durationSeconds / 3600).toFixed(1)} hrs · {row.activeMileage} active · {row.deadMileage} dead
                      </Text>
                    </View>
                    <CurrencyText amount={row.grossRevenue + row.tipsRevenue} size="sm" className="font-bold text-white" />
                  </View>
                ))}
              </View>
            </>
          )}

          <View className="flex-row gap-3 mt-3">
            <TouchableOpacity onPress={() => { setErrorMessage(""); setStep(2); }} className="flex-1 py-3.5 bg-[#1f1f1f] border border-[#27272a] rounded-xl items-center">
              <Text className="text-zinc-300 text-xs font-bold uppercase tracking-wider">Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={executeImport}
              disabled={isImporting || validRows.length === 0}
              style={{ backgroundColor: validRows.length === 0 ? "#27272a" : accentColor }}
              className="flex-1 py-3.5 rounded-xl items-center justify-center"
            >
              {isImporting ? (
                <ActivityIndicator size="small" color={accentColorContrast} />
              ) : (
                <Text style={{ color: validRows.length === 0 ? "#71717a" : accentColorContrast }} className="text-xs font-bold uppercase tracking-wider">
                  Import {validRows.length} Shifts
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* STEP 4: SUMMARY */}
      {step === 4 && (
        <View className="bg-[#0d0d0d] border border-[#1f1f1f] rounded-2xl p-5 flex flex-col gap-4 items-center justify-center py-10">
          <View
            className="w-14 h-14 rounded-2xl items-center justify-center border"
            style={{ backgroundColor: accentColorDim, borderColor: accentColor }}
          >
            <Text className="text-2xl font-bold" style={{ color: accentColor }}>✓</Text>
          </View>
          <Text className="text-white font-bold text-base tracking-tight mt-2">Import Complete</Text>
          <Text className="text-zinc-500 text-xs text-center px-4 leading-relaxed font-medium">
            Your CSV data has been written to your local database.
          </Text>

          <View className="w-full flex flex-col gap-2 mt-4">
            <View className="flex-row justify-between items-center bg-[#000000] px-4 py-3 rounded-xl border border-[#1f1f1f]">
              <Text className="text-xs text-zinc-400 font-bold uppercase tracking-wide">Imported</Text>
              <Text className="text-xs font-extrabold" style={{ color: accentColor }}>{importResult?.success ?? 0} shifts</Text>
            </View>
            <View className="flex-row justify-between items-center bg-[#000000] px-4 py-3 rounded-xl border border-[#1f1f1f]">
              <Text className="text-xs text-zinc-400 font-bold uppercase tracking-wide">Skipped / invalid</Text>
              <Text className="text-xs font-extrabold text-rose-400">{importResult?.skipped ?? 0} rows</Text>
            </View>
          </View>

          <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: accentColor }} className="w-full py-4 rounded-xl items-center mt-4">
            <Text style={{ color: accentColorContrast }} className="text-xs font-bold uppercase tracking-wider">Finish & Close</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

// ── Column dropdown picker ───────────────────────────────────────────────────
function ColumnSelect({
  label,
  headers,
  value,
  accentColor,
  onChange,
}: {
  label: string;
  headers: string[];
  value: string;
  accentColor: string;
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View className="flex flex-col gap-1.5">
      <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider pl-1">{label}</Text>
      <View className="bg-[#000000] border border-[#1f1f1f] rounded-xl overflow-hidden">
        {Platform.OS === "web" ? (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{
              background: "transparent",
              color: "#f4f4f5",
              border: "none",
              padding: "12px 16px",
              fontSize: "13px",
              fontWeight: 600,
              width: "100%",
              outline: "none",
            }}
          >
            <option value="" style={{ background: "#0d0d0d" }}>— Skip —</option>
            {headers.map((h) => (
              <option key={h} value={h} style={{ background: "#0d0d0d" }}>{h}</option>
            ))}
          </select>
        ) : (
          <TouchableOpacity onPress={() => setOpen(true)} className="px-4 py-3.5 flex-row justify-between items-center">
            <Text className="text-zinc-200 text-sm font-semibold" numberOfLines={1}>
              {value || "— Skip —"}
            </Text>
            <Text style={{ color: accentColor }} className="text-[10px] uppercase font-bold tracking-wider ml-2">Choose</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Native picker modal — scrollable, no Alert button limit */}
      {Platform.OS !== "web" && (
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => setOpen(false)} className="flex-1 bg-black/70 justify-center px-6">
            <View className="bg-[#0d0d0d] border border-[#1f1f1f] rounded-2xl overflow-hidden max-h-[70%]">
              <View className="px-4 py-3.5 border-b border-[#1f1f1f]">
                <Text className="text-white text-sm font-bold tracking-tight">{label}</Text>
              </View>
              <ScrollView>
                <TouchableOpacity
                  onPress={() => { onChange(""); setOpen(false); }}
                  className="px-4 py-3.5 border-b border-[#161615] flex-row justify-between items-center"
                >
                  <Text className="text-zinc-400 text-sm font-medium">— Skip —</Text>
                  {value === "" && <Text style={{ color: accentColor }} className="text-xs font-bold">✓</Text>}
                </TouchableOpacity>
                {headers.map((h) => (
                  <TouchableOpacity
                    key={h}
                    onPress={() => { onChange(h); setOpen(false); }}
                    className="px-4 py-3.5 border-b border-[#161615] flex-row justify-between items-center"
                  >
                    <Text className="text-zinc-200 text-sm font-semibold flex-1 pr-2" numberOfLines={1}>{h}</Text>
                    {value === h && <Text style={{ color: accentColor }} className="text-xs font-bold">✓</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}
