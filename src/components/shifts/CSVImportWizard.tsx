import React, { useState } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import Papa from "papaparse";
import { Text } from "../ui/text";
import { CurrencyText } from "../ui/CurrencyText";
import { insertManyShifts } from "../../database/queries/shifts";
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

export function CSVImportWizard() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [fileName, setFileName] = useState("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [isParsing, setIsParsing] = useState(false);

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

  // Final validation results
  const [validRows, setValidRows] = useState<any[]>([]);
  const [invalidRowCount, setInvalidRowCount] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; skipped: number } | null>(null);

  // Step 1: Pick Document & Parse Headers
  const pickCSV = async () => {
    try {
      setIsParsing(true);
      const res = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values"],
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
          reader.onload = (e) => resolve(e.target?.result as string || "");
          reader.onerror = (err) => reject(err);
          reader.readAsText(asset.file!);
        });
      } else {
        csvText = await FileSystem.readAsStringAsync(asset.uri);
      }

      // Parse with PapaParse
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setIsParsing(false);
          if (results.errors.length > 0 && results.data.length === 0) {
            Alert.alert("Parsing Error", "Could not parse the CSV file format.");
            return;
          }
          if (results.meta && results.meta.fields) {
            setCsvHeaders(results.meta.fields);
            setCsvRows(results.data);
            
            // Try to auto-map common headers
            const autoMap: Mapping = {
              platform: "",
              startTime: "",
              endTime: "",
              grossRevenue: "",
              tipsRevenue: "",
              activeMileage: "",
              deadMileage: "",
            };

            results.meta.fields.forEach((field) => {
              const lower = field.toLowerCase();
              if (lower.includes("platform") || lower.includes("app") || lower.includes("gig")) autoMap.platform = field;
              if (lower.includes("start") || lower.includes("date") || lower.includes("from")) autoMap.startTime = field;
              if (lower.includes("end") || lower.includes("time") || lower.includes("to")) autoMap.endTime = field;
              if (lower.includes("gross") || lower.includes("earning") || lower.includes("payout") || lower.includes("revenue")) autoMap.grossRevenue = field;
              if (lower.includes("tip")) autoMap.tipsRevenue = field;
              if (lower.includes("active") || lower.includes("mile") || lower.includes("dist")) autoMap.activeMileage = field;
              if (lower.includes("dead") || lower.includes("untracked")) autoMap.deadMileage = field;
            });

            setMapping(autoMap);
            setStep(2);
          } else {
            Alert.alert("Header Error", "CSV file must contain a header row.");
          }
        },
        error: (err: any) => {
          setIsParsing(false);
          Alert.alert("Error", `CSV parse error: ${err.message}`);
        },
      });
    } catch (err: any) {
      setIsParsing(false);
      Alert.alert("Error", `Failed to read file: ${err?.message || err}`);
    }
  };

  // Step 2: Validate Mapping & Parse Mapped Rows
  const processMapping = () => {
    if (!mapping.platform || !mapping.startTime || !mapping.endTime) {
      Alert.alert("Validation", "Platform, Start Time, and End Time are required mappings.");
      return;
    }

    const parsed: any[] = [];
    let invalidCount = 0;

    csvRows.forEach((row, index) => {
      const platformRaw = (row[mapping.platform] || "").toString().toLowerCase().trim();
      let platformKey = "other";
      if (platformRaw.includes("dash")) platformKey = "doordash";
      else if (platformRaw.includes("eat")) platformKey = "ubereats";
      else if (platformRaw.includes("skip")) platformKey = "skip";

      const startVal = row[mapping.startTime];
      const endVal = row[mapping.endTime];

      const startTimeObj = startVal ? new Date(startVal) : null;
      const endTimeObj = endVal ? new Date(endVal) : null;

      // Basic Date Validations
      if (!startTimeObj || isNaN(startTimeObj.getTime()) || !endTimeObj || isNaN(endTimeObj.getTime())) {
        invalidCount++;
        return;
      }

      const gross = parseFloat(row[mapping.grossRevenue]) || 0;
      const tips = parseFloat(row[mapping.tipsRevenue]) || 0;
      const active = parseFloat(row[mapping.activeMileage]) || 0;
      const dead = parseFloat(row[mapping.deadMileage]) || 0;

      const durationSec = Math.max(0, Math.floor((endTimeObj.getTime() - startTimeObj.getTime()) / 1000));

      parsed.push({
        id: `shift_import_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 5)}`,
        vehicleId: null,
        platform: platformKey,
        startTime: startTimeObj,
        endTime: endTimeObj,
        grossRevenue: gross,
        tipsRevenue: tips,
        trackedMileage: active,
        activeMileage: active,
        deadMileage: dead,
        durationSeconds: durationSec,
        pausedSeconds: 0,
        notes: `CSV Imported from ${fileName}`,
      });
    });

    setValidRows(parsed);
    setInvalidRowCount(invalidCount);
    setStep(3);
  };

  // Step 3: Run insertManyShifts
  const executeImport = async () => {
    if (validRows.length === 0) {
      Alert.alert("No Data", "There are no valid rows to import.");
      return;
    }

    setIsImporting(true);
    try {
      const res = await insertManyShifts(validRows);
      setImportResult({ success: res.successCount, skipped: res.skippedCount + invalidRowCount });
      
      // Invalidate queries to update shift list & dashboard stats
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      
      setStep(4);
    } catch (err: any) {
      Alert.alert("Import Failed", err?.message || "Database insert error.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleFinish = () => {
    router.back();
  };

  return (
    <ScrollView contentContainerClassName="flex flex-col gap-5 pb-8">
      {/* Wizard Header Progress */}
      <View className="flex-row items-center justify-between bg-slate-900/40 p-4 border border-slate-800 rounded-2xl">
        {[1, 2, 3, 4].map((num) => (
          <View key={num} className="flex-row items-center flex-1 justify-center">
            <View
              className={`w-7 h-7 rounded-full items-center justify-center border-2 ${
                step === num
                  ? "border-emerald-500 bg-emerald-500/10"
                  : step > num
                  ? "border-emerald-600 bg-emerald-600"
                  : "border-slate-800 bg-slate-900/60"
              }`}
            >
              <Text className={`text-xs font-bold ${step >= num ? "text-slate-100" : "text-slate-500"}`}>
                {num}
              </Text>
            </View>
            {num < 4 && <View className={`h-0.5 flex-1 mx-2 ${step > num ? "bg-emerald-600" : "bg-slate-800"}`} />}
          </View>
        ))}
      </View>

      {/* STEP 1: UPLOAD */}
      {step === 1 && (
        <View className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 flex flex-col gap-4 items-center justify-center py-10">
          <Text className="text-3xl">📄</Text>
          <Text className="text-slate-100 font-extrabold text-base tracking-tight mt-2">Upload CSV File</Text>
          <Text className="text-slate-400 text-xs text-center px-4 leading-relaxed font-medium">
            Select a raw CSV export from your gig platform. Make sure the file contains column headers.
          </Text>

          {isParsing ? (
            <ActivityIndicator size="small" color="#10b981" className="mt-4" />
          ) : (
            <TouchableOpacity
              onPress={pickCSV}
              className="mt-6 px-6 py-3.5 bg-emerald-500 rounded-xl shadow-lg shadow-emerald-500/10"
            >
              <Text className="text-white text-xs font-bold uppercase tracking-wider">Choose CSV Document</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* STEP 2: COLUMN MAPPING */}
      {step === 2 && (
        <View className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 flex flex-col gap-4">
          <View className="flex-col gap-1 mb-2">
            <Text className="text-slate-100 font-extrabold text-sm tracking-tight">Map CSV Columns</Text>
            <Text className="text-slate-400 text-xs font-medium">
              Link required shift database fields to your CSV columns.
            </Text>
          </View>

          <ColumnSelect
            label="Gig Platform *"
            headers={csvHeaders}
            value={mapping.platform}
            onChange={(val) => setMapping((m) => ({ ...m, platform: val }))}
          />
          <ColumnSelect
            label="Start Date/Time *"
            headers={csvHeaders}
            value={mapping.startTime}
            onChange={(val) => setMapping((m) => ({ ...m, startTime: val }))}
          />
          <ColumnSelect
            label="End Date/Time *"
            headers={csvHeaders}
            value={mapping.endTime}
            onChange={(val) => setMapping((m) => ({ ...m, endTime: val }))}
          />
          <ColumnSelect
            label="Gross Earnings"
            headers={csvHeaders}
            value={mapping.grossRevenue}
            onChange={(val) => setMapping((m) => ({ ...m, grossRevenue: val }))}
          />
          <ColumnSelect
            label="Tips Earnings"
            headers={csvHeaders}
            value={mapping.tipsRevenue}
            onChange={(val) => setMapping((m) => ({ ...m, tipsRevenue: val }))}
          />
          <ColumnSelect
            label="Active Distance"
            headers={csvHeaders}
            value={mapping.activeMileage}
            onChange={(val) => setMapping((m) => ({ ...m, activeMileage: val }))}
          />
          <ColumnSelect
            label="Dead Distance"
            headers={csvHeaders}
            value={mapping.deadMileage}
            onChange={(val) => setMapping((m) => ({ ...m, deadMileage: val }))}
          />

          <View className="flex-row gap-3 mt-4">
            <TouchableOpacity
              onPress={() => setStep(1)}
              className="flex-1 py-3.5 border border-slate-800 rounded-xl items-center"
            >
              <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider">Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={processMapping}
              className="flex-1 py-3.5 bg-emerald-500 rounded-xl items-center"
            >
              <Text className="text-white text-xs font-bold uppercase tracking-wider">Preview</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* STEP 3: PREVIEW */}
      {step === 3 && (
        <View className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 flex flex-col gap-4">
          <View className="flex-col gap-1 mb-2">
            <Text className="text-slate-100 font-extrabold text-sm tracking-tight">Data Preview</Text>
            <Text className="text-slate-400 text-xs font-medium">
              Review parsed shifts from your CSV data.
            </Text>
          </View>

          <View className="flex-row justify-between bg-slate-950/20 p-3 rounded-xl border border-slate-800/40">
            <View className="items-center flex-1 border-r border-slate-800/40">
              <Text className="text-sm font-extrabold text-emerald-400">{validRows.length}</Text>
              <Text className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Valid Shifts</Text>
            </View>
            <View className="items-center flex-1">
              <Text className="text-sm font-extrabold text-rose-400">{invalidRowCount}</Text>
              <Text className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Skipped Rows</Text>
            </View>
          </View>

          <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1 mt-2">First 5 Sample Records</Text>
          <View className="flex flex-col gap-2">
            {validRows.slice(0, 5).map((row, idx) => (
              <View
                key={idx}
                className="bg-slate-950/30 border border-slate-800/40 p-3 rounded-xl flex-row justify-between items-center"
              >
                <View className="flex-col gap-1 flex-1 pr-2">
                  <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {row.platform}
                  </Text>
                  <Text className="text-[11px] text-slate-300 font-medium">
                    {row.startTime.toLocaleDateString(undefined, { dateStyle: "medium" })}
                  </Text>
                  <Text className="text-[10px] text-slate-500 font-medium">
                    {(row.durationSeconds / 3600).toFixed(1)} hrs | {row.activeMileage} mi
                  </Text>
                </View>
                <CurrencyText amount={row.grossRevenue + row.tipsRevenue} size="sm" className="font-bold text-slate-100" />
              </View>
            ))}
          </View>

          <View className="flex-row gap-3 mt-4">
            <TouchableOpacity
              onPress={() => setStep(2)}
              className="flex-1 py-3.5 border border-slate-800 rounded-xl items-center"
            >
              <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider">Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={executeImport}
              disabled={isImporting}
              className="flex-1 py-3.5 bg-emerald-500 rounded-xl items-center justify-center"
            >
              {isImporting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white text-xs font-bold uppercase tracking-wider">Execute Import</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* STEP 4: CONFIRM SUMMARY */}
      {step === 4 && (
        <View className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 flex flex-col gap-4 items-center justify-center py-10">
          <Text className="text-3xl">🎉</Text>
          <Text className="text-slate-100 font-extrabold text-base tracking-tight mt-2">Import Finished</Text>
          <Text className="text-slate-400 text-xs text-center px-4 leading-relaxed font-medium">
            Your CSV data has been successfully written to your local database store.
          </Text>

          <View className="w-full flex flex-col gap-2 mt-6">
            <View className="flex-row justify-between items-center bg-slate-950/20 px-4 py-3 rounded-xl border border-slate-800/40">
              <Text className="text-xs text-slate-400 font-bold uppercase tracking-wide">Imported successfully</Text>
              <Text className="text-xs font-extrabold text-emerald-400">{importResult?.success} shifts</Text>
            </View>
            <View className="flex-row justify-between items-center bg-slate-950/20 px-4 py-3 rounded-xl border border-slate-800/40">
              <Text className="text-xs text-slate-400 font-bold uppercase tracking-wide">Skipped/Invalid rows</Text>
              <Text className="text-xs font-extrabold text-rose-400">{importResult?.skipped} rows</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleFinish}
            className="w-full py-4 bg-emerald-500 rounded-xl items-center mt-6"
          >
            <Text className="text-white text-xs font-bold uppercase tracking-wider">Finish & Close</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

// Custom Dropdown Picker Component
function ColumnSelect({
  label,
  headers,
  value,
  onChange,
}: {
  label: string;
  headers: string[];
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <View className="flex flex-col gap-1.5">
      <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider pl-1">{label}</Text>
      <View className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden">
        {Platform.OS === "web" ? (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{
              background: "transparent",
              color: "#f8fafc",
              border: "none",
              padding: "12px 16px",
              fontSize: "12px",
              width: "100%",
              outline: "none",
            }}
          >
            <option value="" style={{ background: "#0b0f19" }}>-- Skip / Default --</option>
            {headers.map((h) => (
              <option key={h} value={h} style={{ background: "#0b0f19" }}>{h}</option>
            ))}
          </select>
        ) : (
          <TouchableOpacity
            onPress={() => {
              const buttons: any[] = [
                { text: "-- Skip / Default --", onPress: () => onChange("") },
                ...headers.map((h) => ({ text: h, onPress: () => onChange(h) })),
                { text: "Cancel", style: "cancel" },
              ];
              Alert.alert(
                `Select column for ${label}`,
                "",
                buttons.slice(0, 12)
              );
            }}
            className="px-4 py-3 flex-row justify-between items-center"
          >
            <Text className="text-slate-200 text-xs font-semibold">
              {value || "-- Skip / Default --"}
            </Text>
            <Text className="text-emerald-500 text-[10px] uppercase font-bold tracking-wider">Choose</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
