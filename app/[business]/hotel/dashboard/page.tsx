"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { getBusinessSettings, type BusinessSettings } from "@/lib/businessApi";
import { convertAmount, formatMoney as formatCurrency } from "@/lib/currency";
import { listCustomers } from "@/lib/customersApi";
import { listExpenses, type ExpenseItem } from "@/lib/expensesApi";
import {
  getHotelHousekeepingTasks,
  getHotelMoments,
  getHotelNightAuditReport,
  getHotelReservations,
  getHotelRooms,
  type HotelHousekeepingTask,
  type HotelMoment,
  type HotelNightAuditReport,
  type HotelReservation,
  type HotelRoom,
} from "@/lib/hotelApi";
import { listHotelOrders, type HotelOrder, type HotelOrderStatus } from "@/lib/hotelOrdersApi";
import { getInventorySummary, type InventorySummaryResult } from "@/lib/inventoryApi";
import { listAllPosSales, type PosSaleHistoryItem } from "@/lib/posApi";
import {
  getArSummary,
  getProfitAndLoss,
  type ArSummaryResult,
  type ProfitAndLossResult,
} from "@/lib/reportsApi";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  type ChartOptions,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BedDouble,
  Boxes,
  CalendarRange,
  CircleDollarSign,
  ClipboardCheck,
  CreditCard,
  Receipt,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
  Tooltip,
  Legend,
  Filler
);

type RangeKey = "7d" | "30d" | "90d";
type Tone = "emerald" | "indigo" | "amber" | "sky" | "rose" | "slate";

const RANGE_OPTIONS: Array<{ id: RangeKey; label: string; days: number }> = [
  { id: "7d", label: "7 jours", days: 7 },
  { id: "30d", label: "30 jours", days: 30 },
  { id: "90d", label: "90 jours", days: 90 },
];

const EMPTY_STOCK: InventorySummaryResult = {
  currency: "USD",
  summary: {
    totalProducts: 0,
    trackedProducts: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    stockUnits: 0,
    stockValue: 0,
    potentialRevenue: 0,
  },
  lowStockProducts: [],
};

const EMPTY_NIGHT_AUDIT: HotelNightAuditReport = {
  date: "",
  currency: "USD",
  rooms_total: 0,
  arrivals_count: 0,
  departures_count: 0,
  in_house_count: 0,
  occupancy_rate: 0,
  room_revenue: 0,
  extra_revenue: 0,
  charges_revenue: 0,
  moments_revenue: 0,
  total_revenue: 0,
  payments_total: 0,
  outstanding_balance: 0,
  adr: 0,
  revpar: 0,
  payments_by_method: {},
  arrivals: [],
  departures: [],
  housekeeping_pending: [],
};

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toInputDate(date: Date): string {
  return toDateKey(date);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildRange(days: number): { keys: string[]; labels: string[]; dates: Date[] } {
  const keys: string[] = [];
  const labels: string[] = [];
  const dates: Date[] = [];
  const today = startOfDay(new Date());

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = addDays(today, -i);
    keys.push(toDateKey(date));
    labels.push(date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }));
    dates.push(date);
  }

  return { keys, labels, dates };
}

function formatMoney(amount: number, currency: string): string {
  return formatCurrency(amount, currency);
}

function formatCompactMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function formatDateTime(value: string | null | undefined): string {
  return parseDate(value)?.toLocaleString("fr-FR") ?? "-";
}

function paymentLabel(value: string | null | undefined): string {
  const method = (value ?? "").trim();
  if (!method) return "Non defini";
  return method.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function normalizeSaleStatus(status: string | null | undefined): string {
  const normalized = (status ?? "").trim().toLowerCase();
  return normalized || "issued";
}

function orderStatusLabel(status: HotelOrderStatus): string {
  if (status === "completed") return "Confirmee";
  if (status === "cancelled") return "Annulee";
  if (status === "on_hold") return "En attente client";
  return "En attente";
}

function orderStatusTone(status: HotelOrderStatus): string {
  if (status === "completed") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "cancelled") return "bg-rose-50 text-rose-700 border-rose-200";
  if (status === "on_hold") return "bg-sky-50 text-sky-700 border-sky-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function roomStatusLabel(status: string | null | undefined): string {
  const key = (status ?? "").trim().toLowerCase();
  if (key === "occupied") return "Occupee";
  if (key === "cleaning") return "Nettoyage";
  if (key === "maintenance") return "Maintenance";
  if (key === "out_of_order") return "Hors service";
  if (key === "dirty") return "Sale";
  return "Disponible";
}

function roomStatusTone(status: string | null | undefined): string {
  const key = (status ?? "").trim().toLowerCase();
  if (key === "occupied") return "bg-blue-50 text-blue-700 border-blue-200";
  if (key === "cleaning") return "bg-amber-50 text-amber-700 border-amber-200";
  if (key === "maintenance" || key === "out_of_order") return "bg-rose-50 text-rose-700 border-rose-200";
  if (key === "dirty") return "bg-orange-50 text-orange-700 border-orange-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

function summaryOrderItems(order: HotelOrder): string {
  const names = order.items
    .slice(0, 3)
    .map((item) => item.product?.name || `Article ${item.id}`)
    .filter(Boolean);
  if (names.length === 0) return `${order.itemsCount} article(s)`;
  if (order.itemsCount > 3) return `${names.join(", ")} +${order.itemsCount - 3}`;
  return names.join(", ");
}

async function listAllExpensesForRange(business: string, from: string, to: string): Promise<ExpenseItem[]> {
  const first = await listExpenses(business, { from, to, page: 1, perPage: 100 });
  if (first.lastPage <= 1) return first.items;

  const rest = await Promise.all(
    Array.from({ length: first.lastPage - 1 }, (_, index) =>
      listExpenses(business, { from, to, page: index + 2, perPage: 100 })
    )
  );

  return first.items.concat(...rest.map((page) => page.items));
}

async function listAllHotelOrders(business: string): Promise<HotelOrder[]> {
  const first = await listHotelOrders(business, { page: 1, perPage: 100 });
  if (first.lastPage <= 1) return first.items;

  const rest = await Promise.all(
    Array.from({ length: first.lastPage - 1 }, (_, index) =>
      listHotelOrders(business, { page: index + 2, perPage: 100 })
    )
  );

  return first.items.concat(...rest.map((page) => page.items));
}

export default function HotelDashboardPage() {
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";

  const [range, setRange] = useState<RangeKey>("30d");
  const [sales, setSales] = useState<PosSaleHistoryItem[]>([]);
  const [inventory, setInventory] = useState<InventorySummaryResult>(EMPTY_STOCK);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [customersTotal, setCustomersTotal] = useState(0);
  const [pnl, setPnl] = useState<ProfitAndLossResult | null>(null);
  const [arSummary, setArSummary] = useState<ArSummaryResult | null>(null);
  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [reservations, setReservations] = useState<HotelReservation[]>([]);
  const [moments, setMoments] = useState<HotelMoment[]>([]);
  const [nightAudit, setNightAudit] = useState<HotelNightAuditReport>(EMPTY_NIGHT_AUDIT);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [hotelOrders, setHotelOrders] = useState<HotelOrder[]>([]);
  const [housekeepingTasks, setHousekeepingTasks] = useState<HotelHousekeepingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const selectedDays = RANGE_OPTIONS.find((item) => item.id === range)?.days ?? 30;
  const exchangeConfig = useMemo(
    () => ({
      exchangeRateDirection: businessSettings?.exchange_rate_direction,
      exchangeRateValue: businessSettings?.exchange_rate_value,
    }),
    [businessSettings]
  );
  const reportCurrency =
    businessSettings?.currency ||
    nightAudit.currency ||
    pnl?.currency ||
    arSummary?.currency ||
    inventory.currency ||
    "USD";
  const convertDisplayAmount = useCallback(
    (amount: number, sourceCurrency?: string | null) =>
      convertAmount(amount, sourceCurrency || reportCurrency, reportCurrency, exchangeConfig),
    [exchangeConfig, reportCurrency]
  );

  const loadDashboard = useCallback(
    async (silent = false) => {
      if (!businessSlug) return;
      if (silent) setRefreshing(true);
      else setLoading(true);

      try {
        const today = startOfDay(new Date());
        const to = toInputDate(today);
        const from = toInputDate(addDays(today, -(selectedDays - 1)));

        const results = await Promise.allSettled([
          getBusinessSettings(businessSlug),
          listAllPosSales(businessSlug, { from, to }, { perPage: 100, maxPages: 10 }),
          getInventorySummary(businessSlug),
          listCustomers(businessSlug, { page: 1, perPage: 1 }),
          getProfitAndLoss(businessSlug, { from, to }),
          getArSummary(businessSlug, { asOf: to }),
          getHotelRooms(businessSlug),
          getHotelReservations(businessSlug),
          getHotelMoments(businessSlug),
          getHotelNightAuditReport(businessSlug, { date: to }),
          listAllExpensesForRange(businessSlug, from, to),
          listAllHotelOrders(businessSlug),
          getHotelHousekeepingTasks(businessSlug, { taskDate: to, all: true }),
        ]);

        const nextWarnings: string[] = [];
        const addWarning = (label: string, reason: unknown) => nextWarnings.push(`${label}: ${getErrorMessage(reason)}`);

        const businessRes = results[0];
        if (businessRes.status === "fulfilled") setBusinessSettings(businessRes.value);
        else {
          setBusinessSettings(null);
          addWarning("Business", businessRes.reason);
        }

        const salesRes = results[1];
        if (salesRes.status === "fulfilled") setSales(salesRes.value);
        else {
          setSales([]);
          addWarning("Ventes", salesRes.reason);
        }

        const stockRes = results[2];
        if (stockRes.status === "fulfilled") setInventory(stockRes.value);
        else {
          setInventory(EMPTY_STOCK);
          addWarning("Stock", stockRes.reason);
        }

        const customersRes = results[3];
        if (customersRes.status === "fulfilled") setCustomersTotal(customersRes.value.total);
        else {
          setCustomersTotal(0);
          addWarning("Clients", customersRes.reason);
        }

        const pnlRes = results[4];
        if (pnlRes.status === "fulfilled") setPnl(pnlRes.value);
        else {
          setPnl(null);
          addWarning("Resultat", pnlRes.reason);
        }

        const arRes = results[5];
        if (arRes.status === "fulfilled") setArSummary(arRes.value);
        else {
          setArSummary(null);
          addWarning("Creances", arRes.reason);
        }

        const roomsRes = results[6];
        if (roomsRes.status === "fulfilled") setRooms(roomsRes.value);
        else {
          setRooms([]);
          addWarning("Chambres", roomsRes.reason);
        }

        const reservationsRes = results[7];
        if (reservationsRes.status === "fulfilled") setReservations(reservationsRes.value);
        else {
          setReservations([]);
          addWarning("Reservations", reservationsRes.reason);
        }

        const momentsRes = results[8];
        if (momentsRes.status === "fulfilled") setMoments(momentsRes.value);
        else {
          setMoments([]);
          addWarning("Moments", momentsRes.reason);
        }

        const auditRes = results[9];
        if (auditRes.status === "fulfilled") setNightAudit(auditRes.value);
        else {
          setNightAudit(EMPTY_NIGHT_AUDIT);
          addWarning("Audit de nuit", auditRes.reason);
        }

        const expensesRes = results[10];
        if (expensesRes.status === "fulfilled") setExpenses(expensesRes.value);
        else {
          setExpenses([]);
          addWarning("Depenses", expensesRes.reason);
        }

        const ordersRes = results[11];
        if (ordersRes.status === "fulfilled") setHotelOrders(ordersRes.value);
        else {
          setHotelOrders([]);
          addWarning("Commandes hotel", ordersRes.reason);
        }

        const housekeepingRes = results[12];
        if (housekeepingRes.status === "fulfilled") setHousekeepingTasks(housekeepingRes.value);
        else {
          setHousekeepingTasks([]);
          addWarning("Housekeeping", housekeepingRes.reason);
        }

        const failures = results.filter((item) => item.status === "rejected").length;
        if (failures === results.length) {
          const rejected = results.find((item): item is PromiseRejectedResult => item.status === "rejected");
          setError(getErrorMessage(rejected?.reason));
        } else {
          setError("");
        }

        setWarnings(nextWarnings);
        setLastUpdatedAt(new Date().toISOString());
      } catch (e) {
        setError(getErrorMessage(e));
      } finally {
        if (silent) setRefreshing(false);
        else setLoading(false);
      }
    },
    [businessSlug, selectedDays]
  );

  useEffect(() => {
    void loadDashboard(false);
  }, [loadDashboard]);

  const insights = useMemo(() => {
    const rangeWindow = buildRange(selectedDays);
    const keyIndex = new Map<string, number>();
    rangeWindow.keys.forEach((key, index) => keyIndex.set(key, index));

    const posSeries = rangeWindow.keys.map(() => 0);
    const hotelSeries = rangeWindow.keys.map(() => 0);
    const expenseSeries = rangeWindow.keys.map(() => 0);
    const occupancySeries = rangeWindow.keys.map(() => 0);
    const momentSeries = rangeWindow.keys.map(() => 0);

    const validSales = sales.filter((sale) => normalizeSaleStatus(sale.status) !== "void");
    for (const sale of validSales) {
      const created = parseDate(sale.createdAt);
      if (!created) continue;
      const index = keyIndex.get(toDateKey(created));
      if (index !== undefined) posSeries[index] += convertDisplayAmount(sale.total, sale.currency);
    }

    for (const expense of expenses) {
      const date = parseDate(expense.expenseDate);
      if (!date) continue;
      const index = keyIndex.get(toDateKey(date));
      if (index !== undefined) expenseSeries[index] += convertDisplayAmount(expense.amount, expense.currency);
    }

    for (const moment of moments) {
      const start = parseDate(moment.start_at);
      if (!start) continue;
      const index = keyIndex.get(toDateKey(start));
      if (index !== undefined) {
        momentSeries[index] += 1;
        if ((moment.status ?? "").trim().toLowerCase() !== "cancelled") {
          hotelSeries[index] += convertDisplayAmount(moment.total_amount, moment.total_currency);
        }
      }
    }

    for (const order of hotelOrders) {
      if (order.status !== "completed") continue;
      const created = parseDate(order.createdAt);
      if (!created) continue;
      const index = keyIndex.get(toDateKey(created));
      if (index !== undefined) hotelSeries[index] += convertDisplayAmount(order.totalAmount, order.currency);
    }

    const datePoints = rangeWindow.dates;
    for (const reservation of reservations) {
      const status = (reservation.status ?? "").trim().toLowerCase();
      if (status === "cancelled" || reservation.cancelled_at || reservation.no_show_at) continue;

      const start = parseDate(reservation.check_in);
      const end = parseDate(reservation.check_out);
      if (!start || !end) continue;

      datePoints.forEach((point, index) => {
        if (point >= startOfDay(start) && point < startOfDay(end)) {
          occupancySeries[index] += 1;
        }
      });

      const checkInIndex = keyIndex.get(toDateKey(start));
      if (checkInIndex !== undefined) {
        hotelSeries[checkInIndex] += convertDisplayAmount(reservation.total_amount, reservation.total_currency);
      }
    }

    const roomStatusMap = new Map<string, number>();
    for (const room of rooms) {
      const key = (room.status ?? "available").trim().toLowerCase() || "available";
      roomStatusMap.set(key, (roomStatusMap.get(key) ?? 0) + 1);
    }

    const orderStatusMap = new Map<HotelOrderStatus, number>();
    hotelOrders.forEach((order) => orderStatusMap.set(order.status, (orderStatusMap.get(order.status) ?? 0) + 1));

    const paymentRows = Object.entries(nightAudit.payments_by_method ?? {})
      .map(([method, amount]) => ({ method: paymentLabel(method), amount: Number(amount) || 0 }))
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    const pendingHousekeeping = housekeepingTasks.filter((task) => {
      const key = (task.status ?? "").trim().toLowerCase();
      return key === "pending" || key === "in_progress";
    });

    const pendingOrders = hotelOrders.filter((order) => order.status === "pending" || order.status === "on_hold");
    const completedOrders = hotelOrders.filter((order) => order.status === "completed");

    const recentOrders = [...hotelOrders]
      .sort((a, b) => (parseDate(b.createdAt)?.getTime() ?? 0) - (parseDate(a.createdAt)?.getTime() ?? 0))
      .slice(0, 8);

    const topArCustomers = [...(arSummary?.rows ?? [])].sort((a, b) => b.balance - a.balance).slice(0, 6);

    const occupiedRoomsNow = rooms.filter((room) => (room.status ?? "").trim().toLowerCase() === "occupied").length;
    const availableRoomsNow = rooms.filter((room) => (room.status ?? "").trim().toLowerCase() === "available").length;
    const roomsEnabledForMoment = rooms.filter((room) => room.is_moment).length;

    return {
      labels: rangeWindow.labels,
      posSeries,
      hotelSeries,
      expenseSeries,
      occupancySeries,
      momentSeries,
      totalPosRevenue: posSeries.reduce((sum, value) => sum + value, 0),
      totalHotelRevenue: hotelSeries.reduce((sum, value) => sum + value, 0),
      totalExpenses: expenseSeries.reduce((sum, value) => sum + value, 0),
      orderStatusRows: Array.from(orderStatusMap.entries()).map(([status, count]) => ({ status, count })),
      roomStatusRows: Array.from(roomStatusMap.entries())
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
      paymentRows,
      pendingOrders,
      completedOrders,
      pendingHousekeeping,
      recentOrders,
      topArCustomers,
      occupiedRoomsNow,
      availableRoomsNow,
      roomsEnabledForMoment,
      totalOutstanding: (arSummary?.totalAr ?? 0) + (nightAudit.outstanding_balance ?? 0),
    };
  }, [
    arSummary,
    convertDisplayAmount,
    expenses,
    hotelOrders,
    moments,
    nightAudit,
    reservations,
    rooms,
    sales,
    selectedDays,
    housekeepingTasks,
  ]);

  const combinedRevenue = insights.totalPosRevenue + insights.totalHotelRevenue;
  const netProfit = pnl?.totals.netProfit ?? combinedRevenue - insights.totalExpenses;
  const occupancyToday = nightAudit.occupancy_rate || (rooms.length > 0 ? (insights.occupiedRoomsNow / rooms.length) * 100 : 0);

  const revenueChartData = useMemo(
    () => ({
      labels: insights.labels,
      datasets: [
        {
          label: "Facturation bar/piscine",
          data: insights.posSeries,
          borderColor: "#0b4f88",
          backgroundColor: "rgba(11, 79, 136, 0.15)",
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 2,
        },
        {
          label: "Hotel et services",
          data: insights.hotelSeries,
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245, 158, 11, 0.18)",
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 2,
        },
        {
          label: "Depenses",
          data: insights.expenseSeries,
          borderColor: "#dc2626",
          backgroundColor: "rgba(220, 38, 38, 0.08)",
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 2,
        },
      ],
    }),
    [insights]
  );

  const revenueChartOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: { legend: { position: "bottom", labels: { boxWidth: 12, usePointStyle: true } } },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, ticks: { callback: (value) => formatCompactMoney(Number(value), reportCurrency) } },
    },
  };

  const operationsChartData = useMemo(
    () => ({
      labels: insights.labels,
      datasets: [
        {
          label: "Chambres occupees",
          data: insights.occupancySeries,
          borderColor: "#16a34a",
          backgroundColor: "rgba(22, 163, 74, 0.15)",
          fill: true,
          tension: 0.32,
          borderWidth: 2,
          pointRadius: 2,
        },
        {
          label: "Moments",
          data: insights.momentSeries,
          borderColor: "#9333ea",
          backgroundColor: "rgba(147, 51, 234, 0.1)",
          fill: true,
          tension: 0.32,
          borderWidth: 2,
          pointRadius: 2,
        },
      ],
    }),
    [insights]
  );

  const operationsChartOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: { legend: { position: "bottom", labels: { boxWidth: 12, usePointStyle: true } } },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, ticks: { precision: 0 } },
    },
  };

  const orderStatusChartData = useMemo(
    () => ({
      labels: insights.orderStatusRows.map((row) => orderStatusLabel(row.status)),
      datasets: [
        {
          data: insights.orderStatusRows.map((row) => row.count),
          backgroundColor: ["#f59e0b", "#38bdf8", "#16a34a", "#ef4444"],
          borderWidth: 2,
          borderColor: "#fff",
        },
      ],
    }),
    [insights.orderStatusRows]
  );

  const orderStatusChartOptions: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: "bottom", labels: { boxWidth: 12, usePointStyle: true } } },
  };

  const paymentMethodChartData = useMemo(
    () => ({
      labels: insights.paymentRows.map((row) => row.method),
      datasets: [
        {
          data: insights.paymentRows.map((row) => row.amount),
          backgroundColor: ["#0b4f88", "#f59e0b", "#16a34a", "#ef4444", "#8b5cf6", "#14b8a6"],
          borderWidth: 2,
          borderColor: "#fff",
        },
      ],
    }),
    [insights.paymentRows]
  );

  const roomStatusChartData = useMemo(
    () => ({
      labels: insights.roomStatusRows.map((row) => roomStatusLabel(row.status)),
      datasets: [
        {
          label: "Chambres",
          data: insights.roomStatusRows.map((row) => row.count),
          backgroundColor: ["#16a34a", "#3b82f6", "#f59e0b", "#ef4444", "#fb923c", "#6b7280"],
          borderRadius: 10,
          maxBarThickness: 44,
        },
      ],
    }),
    [insights.roomStatusRows]
  );

  const roomStatusChartOptions: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, ticks: { precision: 0 } },
    },
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-blue-200 bg-gradient-to-r from-[#0b4f88] via-[#0d63b8] to-[#f59e0b] p-5 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-100">
              <Sparkles className="h-3.5 w-3.5" />
              Dashboard 360 hotel
            </div>
            <h1 className="mt-3 text-2xl font-semibold">Vue globale du systeme</h1>
            <p className="mt-1 text-sm text-slate-200">
              Reservations, facturation, stock, depenses, creances et operations hotel sur le meme ecran.
            </p>
            <p className="mt-2 text-xs text-slate-300">
              Derniere mise a jour: {lastUpdatedAt ? formatDateTime(lastUpdatedAt) : "en attente"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setRange(option.id)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  range === option.id
                    ? "border-white bg-white text-slate-900"
                    : "border-slate-300/40 bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void loadDashboard(true)}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300/40 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-60"
            >
              <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Actualiser
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</section>
      ) : null}

      {warnings.length > 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="mb-1 inline-flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            Donnees partielles
          </div>
          {warnings.slice(0, 5).map((warning, index) => (
            <p key={`${warning}-${index}`}>- {warning}</p>
          ))}
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Revenus systeme"
          value={formatMoney(combinedRevenue, reportCurrency)}
          note={`Hotel: ${formatMoney(insights.totalHotelRevenue, reportCurrency)} | Bar/piscine: ${formatMoney(insights.totalPosRevenue, reportCurrency)}`}
          icon={CircleDollarSign}
          tone="emerald"
        />
        <MetricCard
          title="Occupation aujourd hui"
          value={`${occupancyToday.toFixed(1)}%`}
          note={`${nightAudit.in_house_count || insights.occupiedRoomsNow} en maison / ${rooms.length} chambres`}
          icon={BedDouble}
          tone="indigo"
        />
        <MetricCard
          title="Commandes en attente"
          value={formatNumber(insights.pendingOrders.length)}
          note={`${formatNumber(insights.completedOrders.length)} deja confirmees`}
          icon={Receipt}
          tone="amber"
        />
        <MetricCard
          title="Depenses periode"
          value={formatMoney(insights.totalExpenses, reportCurrency)}
          note={`Resultat net: ${formatMoney(netProfit, reportCurrency)}`}
          icon={Wallet}
          tone={netProfit >= 0 ? "sky" : "rose"}
        />
        <MetricCard
          title="Creances a suivre"
          value={formatMoney(insights.totalOutstanding, reportCurrency)}
          note={`AR: ${formatMoney(arSummary?.totalAr ?? 0, reportCurrency)} | Folios: ${formatMoney(nightAudit.outstanding_balance ?? 0, reportCurrency)}`}
          icon={CreditCard}
          tone="rose"
        />
        <MetricCard
          title="Valeur stock"
          value={formatMoney(inventory.summary.stockValue, reportCurrency)}
          note={`${formatNumber(inventory.summary.lowStockCount)} alertes stock faible`}
          icon={Boxes}
          tone="slate"
        />
        <MetricCard
          title="Clients actifs"
          value={formatNumber(customersTotal)}
          note={`${formatNumber(rooms.length)} chambres | ${formatNumber(insights.roomsEnabledForMoment)} pour moments`}
          icon={Users}
          tone="sky"
        />
        <MetricCard
          title="Housekeeping a traiter"
          value={formatNumber(insights.pendingHousekeeping.length)}
          note={`${formatNumber(insights.availableRoomsNow)} chambres disponibles maintenant`}
          icon={ClipboardCheck}
          tone="amber"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <PulseCard title="Arrivees du jour" value={formatNumber(nightAudit.arrivals_count)} note="Reservations attendues" />
        <PulseCard title="Departs du jour" value={formatNumber(nightAudit.departures_count)} note="Check-out planifies" />
        <PulseCard title="Paiements du jour" value={formatMoney(nightAudit.payments_total, reportCurrency)} note="Encaissements hotel" />
        <PulseCard title="Revenu hotel du jour" value={formatMoney(nightAudit.total_revenue, reportCurrency)} note="Chambres, extras et moments" />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title={`Flux de revenus (${selectedDays} jours)`} loading={loading} className="xl:col-span-2">
          {revenueChartData.datasets.every((dataset) => dataset.data.every((value) => value === 0)) ? (
            <EmptyPanel text="Aucune donnee financiere sur la periode." />
          ) : (
            <div className="h-80">
              <Line data={revenueChartData} options={revenueChartOptions} />
            </div>
          )}
        </Panel>

        <Panel title="Statut des commandes hotel" loading={loading}>
          {insights.orderStatusRows.length === 0 ? (
            <EmptyPanel text="Aucune commande hotel disponible." />
          ) : (
            <>
              <div className="h-64">
                <Doughnut data={orderStatusChartData} options={orderStatusChartOptions} />
              </div>
              <div className="mt-3 space-y-2">
                {insights.orderStatusRows.map((row) => (
                  <div key={row.status} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{orderStatusLabel(row.status)}</span>
                    <span className="font-semibold text-slate-900">{formatNumber(row.count)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title="Occupation et moments" loading={loading} className="xl:col-span-2">
          {operationsChartData.datasets.every((dataset) => dataset.data.every((value) => value === 0)) ? (
            <EmptyPanel text="Aucune activite hotel exploitable sur la periode." />
          ) : (
            <div className="h-80">
              <Line data={operationsChartData} options={operationsChartOptions} />
            </div>
          )}
        </Panel>

        <Panel title="Paiements hotel du jour" loading={loading}>
          {insights.paymentRows.length === 0 ? (
            <EmptyPanel text="Aucun paiement hotel journalier." />
          ) : (
            <>
              <div className="h-64">
                <Doughnut data={paymentMethodChartData} options={orderStatusChartOptions} />
              </div>
              <div className="mt-3 space-y-2">
                {insights.paymentRows.map((row) => (
                  <div key={row.method} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{row.method}</span>
                    <span className="font-semibold text-slate-900">{formatMoney(row.amount, reportCurrency)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title="Etat des chambres" loading={loading}>
          {insights.roomStatusRows.length === 0 ? (
            <EmptyPanel text="Aucune chambre trouvee." />
          ) : (
            <>
              <div className="h-56">
                <Bar data={roomStatusChartData} options={roomStatusChartOptions} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {insights.roomStatusRows.map((row) => (
                  <span
                    key={row.status}
                    className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${roomStatusTone(row.status)}`}
                  >
                    {roomStatusLabel(row.status)}: {formatNumber(row.count)}
                  </span>
                ))}
              </div>
            </>
          )}
        </Panel>

        <Panel title="Top clients en creance" loading={loading}>
          {insights.topArCustomers.length === 0 ? (
            <EmptyPanel text="Aucune creance client." />
          ) : (
            <div className="space-y-3">
              {insights.topArCustomers.map((row, index) => {
                const ratio = (arSummary?.totalAr ?? 0) > 0 ? (row.balance / (arSummary?.totalAr ?? 1)) * 100 : 0;
                return (
                  <div key={`${row.customerId || row.name}-${index}`}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-slate-700">{row.name}</span>
                      <span className="font-semibold text-slate-900">{formatMoney(row.balance, reportCurrency)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-[#0b4f88]"
                        style={{ width: `${Math.max(4, Math.min(100, ratio))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Alertes operationnelles" loading={loading}>
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-100 p-3">
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                Housekeeping
              </div>
              <p className="text-sm text-slate-600">
                {formatNumber(insights.pendingHousekeeping.length)} tache(s) pending ou en cours aujourd hui.
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 p-3">
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Boxes className="h-4 w-4 text-rose-600" />
                Stock
              </div>
              <p className="text-sm text-slate-600">
                {formatNumber(inventory.summary.lowStockCount)} produit(s) sous le seuil et {formatNumber(inventory.summary.outOfStockCount)} rupture(s).
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 p-3">
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <CalendarRange className="h-4 w-4 text-blue-600" />
                Hotel
              </div>
              <p className="text-sm text-slate-600">
                {formatNumber(nightAudit.arrivals_count)} arrivee(s), {formatNumber(nightAudit.departures_count)} depart(s), {formatNumber(nightAudit.in_house_count)} chambre(s) en maison.
              </p>
            </div>
          </div>
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title="Commandes hotel recentes" loading={loading} className="xl:col-span-2">
          {insights.recentOrders.length === 0 ? (
            <EmptyPanel text="Aucune commande hotel recente." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Commande</th>
                    <th className="px-3 py-2">Client / chambre</th>
                    <th className="px-3 py-2">Articles</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2 text-right">Montant</th>
                    <th className="px-3 py-2">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {insights.recentOrders.map((order, index) => (
                    <tr key={order.id || `${order.invoiceNumber}-${index}`} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2 font-semibold text-slate-800">{order.invoiceNumber || `CMD-${order.id}`}</td>
                      <td className="px-3 py-2 text-slate-700">
                        <div>{order.customer?.name || "Client chambre"}</div>
                        <div className="text-xs text-slate-500">{order.room?.name || order.room?.roomNumber || "-"}</div>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{summaryOrderItems(order)}</td>
                      <td className="px-3 py-2 text-slate-600">{formatDateTime(order.createdAt)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-900">{formatMoney(convertDisplayAmount(order.totalAmount, order.currency), reportCurrency)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${orderStatusTone(order.status)}`}>
                          {orderStatusLabel(order.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Stock faible" loading={loading}>
          {inventory.lowStockProducts.length === 0 ? (
            <EmptyPanel text="Aucune alerte stock." />
          ) : (
            <div className="space-y-3">
              {inventory.lowStockProducts.slice(0, 6).map((item, index) => (
                <div key={item.id || `${item.sku}-${index}`} className="rounded-xl border border-slate-100 p-3">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.sku || "SKU non defini"}</p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-semibold text-rose-700">{formatNumber(item.stock)} u</p>
                      <p className="text-slate-500">Seuil {formatNumber(item.alertQuantity)}</p>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-rose-500"
                      style={{ width: `${Math.max(4, Math.min(100, (item.stock / Math.max(1, item.alertQuantity)) * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
}

function Panel({
  title,
  children,
  loading = false,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  loading?: boolean;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <h2 className="mb-3 border-b border-slate-100 pb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
        {title}
      </h2>
      {loading ? <div className="py-12 text-center text-sm text-slate-500">Chargement...</div> : children}
    </section>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return <div className="py-12 text-center text-sm text-slate-500">{text}</div>;
}

function MetricCard({
  title,
  value,
  note,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  note: string;
  icon: LucideIcon;
  tone: Tone;
}) {
  const tones: Record<Tone, { badge: string; icon: string; value: string }> = {
    emerald: { badge: "bg-emerald-50", icon: "text-emerald-700", value: "text-emerald-800" },
    indigo: { badge: "bg-[#e7f0f9]", icon: "text-[#0b4f88]", value: "text-[#0b4f88]" },
    amber: { badge: "bg-amber-50", icon: "text-amber-700", value: "text-amber-800" },
    sky: { badge: "bg-blue-50", icon: "text-blue-700", value: "text-blue-800" },
    rose: { badge: "bg-rose-50", icon: "text-rose-700", value: "text-rose-800" },
    slate: { badge: "bg-orange-50", icon: "text-orange-700", value: "text-orange-800" },
  };
  const style = tones[tone];

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
          <p className={`mt-2 truncate text-2xl font-bold ${style.value}`}>{value}</p>
          <p className="mt-1 text-xs text-slate-500">{note}</p>
        </div>
        <span className={`inline-flex rounded-xl p-2 ${style.badge}`}>
          <Icon className={`h-5 w-5 ${style.icon}`} />
        </span>
      </div>
    </article>
  );
}

function PulseCard({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </article>
  );
}
