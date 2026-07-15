import React, { useState } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
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
import { useColors } from "../../theme/useColors";
import { withAlpha } from "../../theme/colors";
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
  const C = useColors();
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
      <View className="flex-row items-center justify-between bg-surface-02 p-4 border border-line-subtle rounded-lg">
        {[1, 2, 3, 4].map((num) => {
          const reached = step >= num;
          return (
            <View key={num} className="flex-row items-center flex-1 justify-center">
              <View
                className="w-7 h-7 rounded-full items-center justify-center border-2"
                style={{
                  borderColor: reached ? accentColor : C.lineStrong,
                  backgroundColor: step > num ? accentColor : reached ? accentColorDim : C.background,
                }}
              >
                <Text
                  variant="labelM"
                  tabular
                  style={{ color: step > num ? accentColorContrast : reached ? accentColor : C.contentMuted }}
                >
                  {num}
                </Text>
              </View>
              {num < 4 && (
                <View className="h-0.5 flex-1 mx-2" style={{ backgroundColor: step > num ? accentColor : C.lineSubtle }} />
              )}
            </View>
          );
        })}
      </View>

      {errorMessage ? (
        <View className="bg-destructive/10 border border-destructive/20 p-4 rounded-lg">
          <Text variant="paragraphS" className="text-destructive">{errorMessage}</Text>
        </View>
      ) : null}

      {/* STEP 1: UPLOAD */}
      {step === 1 && (
        <View className="bg-surface-02 border border-line-subtle rounded-lg p-5 flex flex-col gap-4 items-center justify-center py-10">
          <View
            className="w-14 h-14 rounded-lg items-center justify-center border"
            style={{ backgroundColor: accentColorDim, borderColor: accentColor }}
          >
            <Text variant="labelXs" style={{ color: accentColor }}>
              CSV
            </Text>
          </View>
          <Text variant="headingS" className="mt-2">Upload CSV File</Text>
          <Text variant="paragraphS" className="text-center px-4 leading-relaxed">
            Select a CSV export from your gig platform. The file must include a header row with column names.
          </Text>

          {isParsing ? (
            <ActivityIndicator size="small" color={accentColor} className="mt-4" />
          ) : (
            <TouchableOpacity
              onPress={pickCSV}
              accessibilityRole="button"
              style={{ backgroundColor: accentColor }}
              className="mt-6 px-6 py-4 rounded-md"
            >
              <Text variant="labelXs" style={{ color: accentColorContrast }}>
                Choose CSV Document
              </Text>
            </TouchableOpacity>
          )}

          <View className="w-full mt-4 bg-background border border-line-subtle rounded-md p-4">
            <Text variant="labelXs" className="text-content-muted mb-1">Expected columns</Text>
            <Text variant="paragraphS" className="text-content-secondary leading-relaxed">
              Platform, Start date/time, End date/time, Gross earnings, Tips, Active distance, Dead distance.
              You map them on the next step.
            </Text>
          </View>

          {/* On the phone, column-mapping on a small screen is fiddly and easy to get wrong.
              The web app opens the same vault, so point drivers there for anything sizeable. */}
          {!isWeb && (
            <View
              className="w-full bg-surface-04 rounded-md p-4 flex flex-col gap-1"
              style={{ borderWidth: 1, borderColor: withAlpha(C.warning, 0.32) }}
            >
              <Text variant="labelXs" style={{ color: C.warning }}>
                Better on a computer
              </Text>
              <Text variant="paragraphS" className="text-content-secondary leading-relaxed">
                You can import here, but mapping columns on a small screen is fiddly and easy to get
                wrong. For a large file, open the Comma web app on a computer and import there — it
                writes to the same vault, so the shifts show up on your phone after the next sync.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* STEP 2: COLUMN MAPPING */}
      {step === 2 && (
        <View className="bg-surface-02 border border-line-subtle rounded-lg p-5 flex flex-col gap-4">
          <View className="flex-col gap-1 mb-1">
            <Text variant="labelM">Map CSV Columns</Text>
            <Text variant="paragraphS">
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
            <TouchableOpacity onPress={() => { setErrorMessage(""); setStep(1); }} accessibilityRole="button" className="flex-1 py-4 bg-surface-04 border border-line-strong rounded-md items-center">
              <Text variant="labelXs" className="text-content-primary">Back</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={processMapping} accessibilityRole="button" style={{ backgroundColor: accentColor }} className="flex-1 py-4 rounded-md items-center">
              <Text variant="labelXs" style={{ color: accentColorContrast }}>Preview</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* STEP 3: PREVIEW */}
      {step === 3 && (
        <View className="bg-surface-02 border border-line-subtle rounded-lg p-5 flex flex-col gap-4">
          <View className="flex-col gap-1 mb-1">
            <Text variant="labelM">Data Preview</Text>
            <Text variant="paragraphS">Review parsed shifts before importing.</Text>
          </View>

          <View className="flex-row justify-between bg-background p-3 rounded-md border border-line-subtle">
            <View className="items-center flex-1 border-r border-line-subtle">
              <Text variant="headingS" tabular style={{ color: accentColor }}>{validRows.length}</Text>
              <Text variant="labelXs" className="text-content-muted mt-0.5">Valid Shifts</Text>
            </View>
            <View className="items-center flex-1">
              <Text variant="headingS" tabular className="text-destructive">{invalidRowCount}</Text>
              <Text variant="labelXs" className="text-content-muted mt-0.5">Skipped Rows</Text>
            </View>
          </View>

          {reasonEntries.length > 0 && (
            <View className="bg-background border border-line-subtle rounded-md p-3 flex flex-col gap-1.5">
              <Text variant="labelXs" className="text-content-muted">Why rows were skipped</Text>
              {reasonEntries.map(([reason, count]) => (
                <View key={reason} className="flex-row justify-between items-center">
                  <Text variant="paragraphS" className="text-content-secondary">{reason}</Text>
                  <Text variant="paragraphS" tabular className="font-bold text-destructive">{count}</Text>
                </View>
              ))}
            </View>
          )}

          {validRows.length > 0 && (
            <>
              <Text variant="labelXs" className="text-content-muted pl-1 mt-1">First 5 Sample Records</Text>
              <View className="flex flex-col gap-2">
                {validRows.slice(0, 5).map((row) => (
                  <View key={row.id} className="bg-background border border-line-subtle p-3 rounded-md flex-row justify-between items-center">
                    <View className="flex-col gap-1.5 flex-1 pr-2">
                      <PlatformBadge platform={row.platform} size="sm" />
                      <Text variant="paragraphS" className="text-content-primary">
                        {row.startTime.toLocaleDateString(undefined, { dateStyle: "medium" })}
                      </Text>
                      <Text variant="paragraphS" tabular>
                        {(row.durationSeconds / 3600).toFixed(1)} hrs · {row.activeMileage} active · {row.deadMileage} dead
                      </Text>
                    </View>
                    <CurrencyText amount={row.grossRevenue + row.tipsRevenue} size="sm" className="font-bold" />
                  </View>
                ))}
              </View>
            </>
          )}

          <View className="flex-row gap-3 mt-3">
            <TouchableOpacity onPress={() => { setErrorMessage(""); setStep(2); }} accessibilityRole="button" className="flex-1 py-4 bg-surface-04 border border-line-strong rounded-md items-center">
              <Text variant="labelXs" className="text-content-primary">Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={executeImport}
              disabled={isImporting || validRows.length === 0}
              accessibilityRole="button"
              accessibilityState={{ disabled: isImporting || validRows.length === 0 }}
              style={{ backgroundColor: validRows.length === 0 ? C.surface05 : accentColor }}
              className="flex-1 py-4 rounded-md items-center justify-center"
            >
              {isImporting ? (
                <ActivityIndicator size="small" color={accentColorContrast} />
              ) : (
                <Text variant="labelXs" style={{ color: validRows.length === 0 ? C.contentSecondary : accentColorContrast }}>
                  Import {validRows.length} Shifts
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* STEP 4: SUMMARY */}
      {step === 4 && (
        <View className="bg-surface-02 border border-line-subtle rounded-lg p-5 flex flex-col gap-4 items-center justify-center py-10">
          <View
            className="w-14 h-14 rounded-lg items-center justify-center border"
            style={{ backgroundColor: accentColorDim, borderColor: accentColor }}
          >
            <Text variant="headingL" style={{ color: accentColor }}>✓</Text>
          </View>
          <Text variant="headingS" className="mt-2">Import Complete</Text>
          <Text variant="paragraphS" className="text-center px-4 leading-relaxed">
            Your CSV data has been written to your local database.
          </Text>

          <View className="w-full flex flex-col gap-2 mt-4">
            <View className="flex-row justify-between items-center bg-background px-4 py-3 rounded-md border border-line-subtle">
              <Text variant="labelXs" className="text-content-secondary">Imported</Text>
              <Text variant="labelM" tabular style={{ color: accentColor }}>{importResult?.success ?? 0} shifts</Text>
            </View>
            <View className="flex-row justify-between items-center bg-background px-4 py-3 rounded-md border border-line-subtle">
              <Text variant="labelXs" className="text-content-secondary">Skipped / invalid</Text>
              <Text variant="labelM" tabular className="text-destructive">{importResult?.skipped ?? 0} rows</Text>
            </View>
          </View>

          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" style={{ backgroundColor: accentColor }} className="w-full py-4 rounded-md items-center mt-4">
            <Text variant="labelXs" style={{ color: accentColorContrast }}>Finish & Close</Text>
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
  const C = useColors();
  const [open, setOpen] = useState(false);

  return (
    <View className="flex flex-col gap-1.5">
      <Text variant="labelXs" className="text-content-secondary pl-1">{label}</Text>
      <View className="bg-background border border-line-subtle rounded-md overflow-hidden">
        {Platform.OS === "web" ? (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{
              background: "transparent",
              color: C.contentPrimary,
              border: "none",
              padding: "12px 16px",
              fontSize: "13px",
              fontWeight: 600,
              width: "100%",
              outline: "none",
            }}
          >
            <option value="" style={{ background: C.surface02 }}>— Skip —</option>
            {headers.map((h) => (
              <option key={h} value={h} style={{ background: C.surface02 }}>{h}</option>
            ))}
          </select>
        ) : (
          <TouchableOpacity onPress={() => setOpen(true)} accessibilityRole="button" className="px-4 py-4 flex-row justify-between items-center">
            <Text variant="labelM" numberOfLines={1}>
              {value || "— Skip —"}
            </Text>
            <Text variant="labelXs" style={{ color: accentColor }} className="ml-2">Choose</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Native picker modal — scrollable, no Alert button limit */}
      {Platform.OS !== "web" && (
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => setOpen(false)} className="flex-1 bg-background/70 justify-center px-6">
            <View className="bg-surface-02 border border-line-subtle rounded-2xl overflow-hidden max-h-[70%]">
              <View className="px-4 py-4 border-b border-line-subtle">
                <Text variant="labelM">{label}</Text>
              </View>
              <ScrollView>
                <TouchableOpacity
                  onPress={() => { onChange(""); setOpen(false); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: value === "" }}
                  className="px-4 py-4 border-b border-line-subtle flex-row justify-between items-center"
                >
                  <Text variant="paragraphM">— Skip —</Text>
                  {value === "" && <Text variant="labelM" style={{ color: accentColor }}>✓</Text>}
                </TouchableOpacity>
                {headers.map((h) => (
                  <TouchableOpacity
                    key={h}
                    onPress={() => { onChange(h); setOpen(false); }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: value === h }}
                    className="px-4 py-4 border-b border-line-subtle flex-row justify-between items-center"
                  >
                    <Text variant="labelM" className="flex-1 pr-2" numberOfLines={1}>{h}</Text>
                    {value === h && <Text variant="labelM" style={{ color: accentColor }}>✓</Text>}
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
