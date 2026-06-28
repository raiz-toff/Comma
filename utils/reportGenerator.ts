import Papa from "papaparse";
import * as Print from "expo-print";
import { Platform } from "react-native";
import { db } from "../src/database/client";
import { shifts, expenses } from "../src/database/schema";
import { and, gte, lte, asc } from "drizzle-orm";
import { useSettingsStore } from "../store/useSettingsStore";
import { resolveAppContext } from "../src/hooks/useAppContext";

const isWeb = Platform.OS === "web";

function getCurrencySymbol(currency?: string): string {
  if (currency === "GBP") return "£";
  if (currency === "EUR") return "€";
  return "$";
}

export async function generateShiftsCSV(startDate: Date, endDate: Date): Promise<string> {
  const profile = useSettingsStore.getState().profile;
  const distUnit = profile?.distanceUnit || "km";
  let list: any[] = [];

  if (isWeb) {
    const existing = localStorage.getItem("comma_shifts");
    if (existing) {
      list = JSON.parse(existing)
        .filter((s: any) => new Date(s.startTime) >= startDate && new Date(s.startTime) <= endDate)
        .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    }
  } else {
    list = await db
      .select()
      .from(shifts)
      .where(and(gte(shifts.startTime, startDate), lte(shifts.startTime, endDate)))
      .orderBy(asc(shifts.startTime));
  }

  const csvRows = list.map((s: any) => {
    const gross = (s.grossRevenue || 0) + (s.tipsRevenue || 0);
    const miles = (s.activeMileage || 0) + (s.deadMileage || 0);
    const writeOff = miles * 0.67;
    const net = gross - writeOff;
    return {
      date: new Date(s.startTime).toLocaleDateString(),
      platform: s.platform,
      grossRevenue: s.grossRevenue,
      tips: s.tipsRevenue || 0,
      totalGrossWithTips: gross,
      [`activeDistance_${distUnit}`]: s.activeMileage || 0,
      [`deadDistance_${distUnit}`]: s.deadMileage || 0,
      [`mileageWriteOff_${distUnit}`]: writeOff,
      netEarnings: net,
      durationSeconds: s.durationSeconds || 0,
      notes: s.notes || "",
    };
  });

  return Papa.unparse(csvRows);
}

export async function generateExpensesCSV(startDate: Date, endDate: Date): Promise<string> {
  let list: any[] = [];

  if (isWeb) {
    const existing = localStorage.getItem("comma_expenses");
    if (existing) {
      list = JSON.parse(existing)
        .filter((e: any) => new Date(e.date) >= startDate && new Date(e.date) <= endDate)
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
  } else {
    list = await db
      .select()
      .from(expenses)
      .where(and(gte(expenses.date, startDate), lte(expenses.date, endDate)))
      .orderBy(asc(expenses.date));
  }

  const csvRows = list.map((e: any) => ({
    date: new Date(e.date).toLocaleDateString(),
    category: e.category,
    amount: e.amount,
    isDeductible: e.isDeductible ? "Yes" : "No",
    notes: e.notes || "",
    linkedShiftId: e.shiftId || "",
  }));

  return Papa.unparse(csvRows);
}

export async function generatePDFSummary(startDate: Date, endDate: Date): Promise<string> {
  const profile = useSettingsStore.getState().profile;
  const featureOverrides = useSettingsStore.getState().featureOverrides || {};
  const appContext = resolveAppContext(
    profile?.persona || "platform_driver",
    profile?.country || "CA",
    featureOverrides
  );

  if (!appContext.features.pdf_reports) {
    throw new Error("PDF report generation is not enabled for your current persona.");
  }

  const currencySymbol = getCurrencySymbol(profile?.locale?.currency);
  const distUnit = profile?.distanceUnit || "km";
  
  let shiftList: any[] = [];
  let expenseList: any[] = [];

  if (isWeb) {
    const existingShifts = localStorage.getItem("comma_shifts");
    if (existingShifts) {
      shiftList = JSON.parse(existingShifts)
        .filter((s: any) => new Date(s.startTime) >= startDate && new Date(s.startTime) <= endDate)
        .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    }
    const existingExpenses = localStorage.getItem("comma_expenses");
    if (existingExpenses) {
      expenseList = JSON.parse(existingExpenses)
        .filter((e: any) => new Date(e.date) >= startDate && new Date(e.date) <= endDate)
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
  } else {
    shiftList = await db
      .select()
      .from(shifts)
      .where(and(gte(shifts.startTime, startDate), lte(shifts.startTime, endDate)))
      .orderBy(asc(shifts.startTime));
    expenseList = await db
      .select()
      .from(expenses)
      .where(and(gte(expenses.date, startDate), lte(expenses.date, endDate)))
      .orderBy(asc(expenses.date));
  }

  // Calculate Aggregates
  const totalGross = shiftList.reduce((sum, s) => sum + (s.grossRevenue || 0), 0);
  const totalTips = shiftList.reduce((sum, s) => sum + (s.tipsRevenue || 0), 0);
  const totalRevenue = totalGross + totalTips;
  const totalDeductibleExpenses = expenseList
    .filter((e) => e.isDeductible)
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalNonDeductibleExpenses = expenseList
    .filter((e) => !e.isDeductible)
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const totalActiveMiles = shiftList.reduce((sum, s) => sum + (s.activeMileage || 0), 0);
  const totalDeadMiles = shiftList.reduce((sum, s) => sum + (s.deadMileage || 0), 0);
  const totalMiles = totalActiveMiles + totalDeadMiles;
  const mileageDeduction = totalMiles * 0.67;

  const netEarnings = totalRevenue - totalDeductibleExpenses - mileageDeduction;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Comma Earnings & Expense Summary</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; padding: 30px; margin: 0; line-height: 1.6; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #10b981; padding-bottom: 15px; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: 800; color: #10b981; margin: 0; letter-spacing: -0.5px; }
          .title { font-size: 16px; color: #64748b; margin: 0; text-align: right; }
          .date-range { font-size: 14px; font-weight: bold; color: #1e293b; }
          .grid { display: flex; gap: 15px; margin-bottom: 30px; }
          .card { flex: 1; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; background: #f8fafc; }
          .card-title { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 5px; }
          .card-value { font-size: 18px; font-weight: 800; color: #0f172a; }
          .card-value.income { color: #10b981; }
          .card-value.expense { color: #ef4444; }
          h3 { font-size: 16px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; color: #475569; margin-top: 30px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #f1f5f9; text-align: left; font-size: 11px; font-weight: bold; color: #475569; text-transform: uppercase; padding: 10px; border-bottom: 1px solid #cbd5e1; }
          td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
          .number-col { text-align: right; }
          .footer { text-align: center; font-size: 11px; color: #94a3b8; margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="logo">COMMA</h1>
            <p class="date-range">Report: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}</p>
          </div>
          <div>
            <h2 class="title">Earnings & Expenses Summary</h2>
          </div>
        </div>

        <div class="grid">
          <div class="card">
            <div class="card-title">Gross Income</div>
            <div class="card-value income">${currencySymbol}${totalRevenue.toFixed(2)}</div>
          </div>
          <div class="card">
            <div class="card-title">Mileage Deduction</div>
            <div class="card-value expense">${currencySymbol}${mileageDeduction.toFixed(2)}</div>
          </div>
          <div class="card">
            <div class="card-title">Expenses (Deductible)</div>
            <div class="card-value expense">${currencySymbol}${totalDeductibleExpenses.toFixed(2)}</div>
          </div>
          <div class="card">
            <div class="card-title">Net Income</div>
            <div class="card-value income" style="color: #3b82f6;">${currencySymbol}${netEarnings.toFixed(2)}</div>
          </div>
        </div>

        <h3>Distance Breakdown (${distUnit})</h3>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th class="number-col">Distance (${distUnit})</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Active (Delivery/Gig) Distance</td>
              <td class="number-col">${totalActiveMiles.toFixed(1)}</td>
            </tr>
            <tr>
              <td>Dead (Commute/Waiting) Distance</td>
              <td class="number-col">${totalDeadMiles.toFixed(1)}</td>
            </tr>
            <tr style="font-weight: bold; background: #f8fafc;">
              <td>Total Distance</td>
              <td class="number-col">${totalMiles.toFixed(1)}</td>
            </tr>
          </tbody>
        </table>

        <h3>Expense Log</h3>
        ${
          expenseList.length === 0
            ? "<p style='font-size: 13px; color: #64748b;'>No expenses recorded in this period.</p>"
            : `
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Deductible</th>
              <th>Notes</th>
              <th class="number-col">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${expenseList
              .map(
                (e) => `
              <tr>
                <td>${new Date(e.date).toLocaleDateString()}</td>
                <td style="text-transform: capitalize;">${e.category}</td>
                <td>${e.isDeductible ? "Yes" : "No"}</td>
                <td>${e.notes || ""}</td>
                <td class="number-col">${currencySymbol}${(e.amount || 0).toFixed(2)}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
        `
        }

        <div class="footer">
          Generated automatically by Comma Gig Driver Tracker. All data stays local.
        </div>
      </body>
    </html>
  `;

  if (isWeb) {
    // Return HTML string to render or print on Web
    return htmlContent;
  }

  // Print to File and return file URI on Native
  const { uri } = await Print.printToFileAsync({ html: htmlContent });
  return uri;
}
