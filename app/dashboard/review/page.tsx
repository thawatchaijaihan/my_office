"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDashboardFetch } from "../useDashboardFetch";

type IndexTableRow = {
  rowNumber: number;
  registeredAt: string;
  rank: string;
  firstName: string;
  lastName: string;
  requestFor: string;
  vehicleOwner: string;
  vehicleType: string;
  vehicleModel: string;
  vehicleColor: string;
  plate: string;
  phone: string;
  note: string;
  paymentStatus: string;
  approvalStatus: string;
  checkedAt: string;
  columnP: string;
};

type ColumnKey = keyof IndexTableRow | "name";

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "rowNumber", label: "ลำดับ" },
  { key: "checkedAt", label: "อัพเดทล่าสุด" },
  { key: "name", label: "ยศ. ชื่อ-สกุล" },
  { key: "requestFor", label: "ขอบัตรให้" },
  { key: "vehicleOwner", label: "เจ้าของรถ" },
  { key: "vehicleType", label: "ประเภทรถ" },
  { key: "vehicleModel", label: "รุ่น" },
  { key: "vehicleColor", label: "สี" },
  { key: "plate", label: "ทะเบียน" },
  { key: "paymentStatus", label: "การชำระเงิน" },
  { key: "approvalStatus", label: "ผลการตรวจ" },
  { key: "columnP", label: "หมายเหตุ" },
];

const NARROW_COLUMN_KEYS: ColumnKey[] = ["requestFor", "vehicleType", "vehicleModel", "vehicleColor"];

type SavedPrefs = {
  columnOrder?: ColumnKey[];
  visibleColumns?: Record<ColumnKey, boolean>;
  selectedMStatuses?: Record<string, boolean>;
  selectedNStatuses?: Record<string, boolean>;
};

function getNameValue(r: IndexTableRow): string {
  const parts = [r.rank, r.firstName, r.lastName].filter(Boolean);
  if (parts.length <= 1) return parts[0] || "-";
  return `${r.rank}${r.firstName} ${r.lastName}`.trim() || "-";
}

function getCellValue(r: IndexTableRow, colKey: ColumnKey): string {
  if (colKey === "name") return getNameValue(r);
  if (colKey === "vehicleOwner") {
    const f = String(r.vehicleOwner ?? "").trim();
    if (!f) return getNameValue(r);
    return f;
  }
  if (colKey === "checkedAt") {
    const o = String(r.checkedAt ?? "").trim();
    if (!o) return String(r.registeredAt ?? "").trim() || "-";
    return o;
  }
  return String(r[colKey as keyof IndexTableRow] ?? "").trim() || "-";
}

export default function ReviewPage() {
  const dashboardFetch = useDashboardFetch();
  const [rows, setRows] = useState<IndexTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(() => COLUMNS.map((c) => c.key));
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(() => {
    const initial: Record<ColumnKey, boolean> = {} as Record<ColumnKey, boolean>;
    for (const col of COLUMNS) {
      initial[col.key] = true;
    }
    // ค่าเริ่มต้น: ซ่อนคอลัมน์ "ขอบัตรให้" และ "เจ้าของรถ"
    initial.requestFor = false;
    initial.vehicleOwner = false;
    return initial;
  });
  const [selectedMStatuses, setSelectedMStatuses] = useState<Record<string, boolean>>({});
  const [selectedNStatuses, setSelectedNStatuses] = useState<Record<string, boolean>>({});
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const lastSavedPayloadRef = useRef<string>("");

  useEffect(() => {
    dashboardFetch("/api/dashboard/review")
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 401 ? "กรุณาใส่ key ใน URL" : "โหลดไม่สำเร็จ");
        return res.json();
      })
      .then((data) => setRows(data.rows ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [dashboardFetch]);

  // โหลดค่าที่บันทึกไว้จาก Realtime DB (ลำดับคอลัมน์ / การแสดงคอลัมน์ / ตัวกรอง)
  useEffect(() => {
    if (prefsLoaded) return;
    let cancelled = false;

    async function load() {
      try {
        const res = await dashboardFetch("/api/dashboard/review/preferences");
        const apiPrefs: SavedPrefs = res.ok ? ((await res.json()) as SavedPrefs) : {};
        if (cancelled) return;

        const defaultOrder = COLUMNS.map((c) => c.key);
        let appliedColumnOrder: ColumnKey[] = defaultOrder;
        const hasColumnOrder = Array.isArray(apiPrefs.columnOrder) && apiPrefs.columnOrder.length > 0;
        if (hasColumnOrder && apiPrefs.columnOrder) {
          const order = apiPrefs.columnOrder;
          const cleanedOrder: ColumnKey[] = [];
          for (const k of order) {
            if (defaultOrder.includes(k) && !cleanedOrder.includes(k)) cleanedOrder.push(k);
          }
          for (const k of defaultOrder) {
            if (!cleanedOrder.includes(k)) cleanedOrder.push(k);
          }
          appliedColumnOrder = cleanedOrder;
          setColumnOrder(cleanedOrder);
        }

        const defaultVisible: Record<ColumnKey, boolean> = {} as Record<ColumnKey, boolean>;
        for (const col of COLUMNS) defaultVisible[col.key] = true;
        const appliedVisibleColumns =
          apiPrefs.visibleColumns && Object.keys(apiPrefs.visibleColumns).length > 0
            ? { ...defaultVisible, ...apiPrefs.visibleColumns }
            : defaultVisible;
        if (Object.keys(apiPrefs.visibleColumns || {}).length > 0) {
          setVisibleColumns((prev) => ({ ...prev, ...apiPrefs.visibleColumns }));
        }

        const appliedM = apiPrefs.selectedMStatuses && Object.keys(apiPrefs.selectedMStatuses).length > 0 ? apiPrefs.selectedMStatuses : {};
        const appliedN = apiPrefs.selectedNStatuses && Object.keys(apiPrefs.selectedNStatuses).length > 0 ? apiPrefs.selectedNStatuses : {};
        if (Object.keys(appliedM).length > 0) setSelectedMStatuses(appliedM);
        if (Object.keys(appliedN).length > 0) setSelectedNStatuses(appliedN);

        if (!cancelled) {
          lastSavedPayloadRef.current = JSON.stringify({
            columnOrder: appliedColumnOrder,
            visibleColumns: appliedVisibleColumns,
            selectedMStatuses: appliedM,
            selectedNStatuses: appliedN,
          });
        }
      } finally {
        if (!cancelled) {
          setPrefsLoaded(true);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [dashboardFetch, prefsLoaded]);

  // สร้างค่าเริ่มต้นของตัวกรอง M/N จาก rows เฉพาะเมื่อยังไม่มีค่าที่โหลดจาก preferences (รอ prefs โหลดก่อนเพื่อไม่ให้เขียนทับ)
  useEffect(() => {
    if (rows.length === 0 || !prefsLoaded) return;

    setSelectedMStatuses((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const next: Record<string, boolean> = {};
      for (const r of rows) {
        const key = (r.paymentStatus ?? "").trim();
        if (!(key in next)) next[key] = true;
      }
      return next;
    });

    setSelectedNStatuses((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const next: Record<string, boolean> = {};
      for (const r of rows) {
        const key = (r.approvalStatus ?? "").trim();
        if (!(key in next)) next[key] = true;
      }
      return next;
    });
  }, [rows, prefsLoaded]);

  // บันทึกค่าปัจจุบันไป Realtime DB (debounce) — ส่ง POST เฉพาะเมื่อ payload เปลี่ยนจากครั้งล่าสุดที่บันทึกแล้ว
  useEffect(() => {
    if (!prefsLoaded) return;
    const payload = {
      columnOrder,
      visibleColumns,
      selectedMStatuses,
      selectedNStatuses,
    };
    const serialized = JSON.stringify(payload);
    if (serialized === lastSavedPayloadRef.current) return;

    let timeout: ReturnType<typeof setTimeout> | undefined;

    async function save() {
      try {
        const res = await dashboardFetch("/api/dashboard/review/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if ((data as { ok?: boolean }).ok) lastSavedPayloadRef.current = serialized;
        if (process.env.NODE_ENV === "development") {
          console.log("[Review prefs] POST result:", { status: res.status, ok: (data as { ok?: boolean }).ok });
        }
      } catch (e) {
        if (process.env.NODE_ENV === "development") console.warn("[Review prefs] POST failed", e);
      }
    }

    timeout = setTimeout(save, 1200);
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [prefsLoaded, dashboardFetch, columnOrder, visibleColumns, selectedMStatuses, selectedNStatuses]);

  // รายการสถานะ M/N จากข้อมูลในตาราง (ไม่จาก selected*) เพื่อไม่ให้แสดง "ไม่มีข้อมูลสถานะ" เมื่อมีแถวอยู่
  const paymentStatusOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const k = (r.paymentStatus ?? "").trim();
      if (k) set.add(k);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "th"));
  }, [rows]);

  const approvalStatusOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const k = (r.approvalStatus ?? "").trim();
      if (k) set.add(k);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "th"));
  }, [rows]);

  const activeMStatuses = useMemo(
    () => Object.entries(selectedMStatuses).filter(([, v]) => v).map(([k]) => k),
    [selectedMStatuses]
  );

  const activeNStatuses = useMemo(
    () => Object.entries(selectedNStatuses).filter(([, v]) => v).map(([k]) => k),
    [selectedNStatuses]
  );

  // จำนวนที่ "แสดง" สำหรับปุ่มตัวเลือก (นับรวมที่ยังไม่เคยตั้ง = แสดง)
  const activeMCount = useMemo(
    () => paymentStatusOptions.filter((k) => selectedMStatuses[k] !== false).length,
    [paymentStatusOptions, selectedMStatuses]
  );
  const activeNCount = useMemo(
    () => approvalStatusOptions.filter((k) => selectedNStatuses[k] !== false).length,
    [approvalStatusOptions, selectedNStatuses]
  );

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return rows.filter((r) => {
      const mRaw = (r.paymentStatus ?? "").trim();
      const nRaw = (r.approvalStatus ?? "").trim();

      // ซ่อนแถวที่คอลัมน์ N เท่ากับ "รอลบข้อมูล"
      if (nRaw === "รอลบข้อมูล") return false;

      // ถ้ามีการตั้งค่า status ใด ๆ แล้ว: แสดงเฉพาะรายการที่สถานะถูกติ๊กไว้
      if (Object.keys(selectedMStatuses).length > 0 && selectedMStatuses[mRaw] === false) {
        return false;
      }
      if (Object.keys(selectedNStatuses).length > 0 && selectedNStatuses[nRaw] === false) {
        return false;
      }

      if (!keyword) return true;

      const name = getNameValue(r).toLowerCase();
      const plate = (r.plate ?? "").toLowerCase();
      const requestFor = (r.requestFor ?? "").toLowerCase();
      const vehicleOwner = (r.vehicleOwner ?? "").toLowerCase();
      const paymentStatus = (r.paymentStatus ?? "").toLowerCase();
      const approvalStatus = (r.approvalStatus ?? "").toLowerCase();
      const columnP = (r.columnP ?? "").toLowerCase();

      return (
        name.includes(keyword) ||
        plate.includes(keyword) ||
        requestFor.includes(keyword) ||
        vehicleOwner.includes(keyword) ||
        paymentStatus.includes(keyword) ||
        approvalStatus.includes(keyword) ||
        columnP.includes(keyword)
      );
    });
  }, [rows, search, selectedMStatuses, selectedNStatuses]);

  const toggleColumn = (key: ColumnKey) => {
    // ลำดับ (rowNumber) บังคับให้แสดงเสมอ ไม่ให้ปิด
    if (key === "rowNumber") return;
    setVisibleColumns((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const visibleCols = useMemo(
    () =>
      columnOrder
        .map((key) => COLUMNS.find((c) => c.key === key)!)
        .filter((c) => visibleColumns[c.key] ?? true),
    [columnOrder, visibleColumns]
  );

  const toggleMStatus = (value: string) => {
    setSelectedMStatuses((prev) => ({
      ...prev,
      [value]: !prev[value],
    }));
  };

  const toggleNStatus = (value: string) => {
    setSelectedNStatuses((prev) => ({
      ...prev,
      [value]: !prev[value],
    }));
  };

  const formatStatusLabel = (value: string, fallback: string) =>
    value && value.trim() ? value.trim() : fallback;

  const handleEditClick = (rowNumber: number, currentValue: string) => {
    setEditingRow(rowNumber);
    setEditValue(currentValue);
  };

  const handleNoteSave = async (rowNumber: number) => {
    setSaving(true);
    try {
      const res = await dashboardFetch("/api/dashboard/review/card-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowNumber, columnP: editValue }),
      });
      if (!res.ok) throw new Error("อัปเดตไม่สำเร็จ");
      setRows((prev) =>
        prev.map((r) => (r.rowNumber === rowNumber ? { ...r, columnP: editValue } : r))
      );
      setEditingRow(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  };

  const handleNoteCancel = () => {
    setEditingRow(null);
    setEditValue("");
  };

  const handleColumnDragStart = (key: ColumnKey) => (e: React.DragEvent<HTMLLabelElement>) => {
    if (key === "rowNumber") return;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", key);
  };

  const handleColumnDragOver = (key: ColumnKey) => (e: React.DragEvent<HTMLLabelElement>) => {
    if (key === "rowNumber") return;
    e.preventDefault();
  };

  const handleColumnDrop = (targetKey: ColumnKey) => (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const sourceKey = e.dataTransfer.getData("text/plain") as ColumnKey;
    if (!sourceKey || sourceKey === targetKey) return;
    if (sourceKey === "rowNumber" || targetKey === "rowNumber") return;

    setColumnOrder((prev) => {
      const next = [...prev];
      const fromIndex = next.indexOf(sourceKey);
      const toIndex = next.indexOf(targetKey);
      if (fromIndex === -1 || toIndex === -1) return prev;
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, sourceKey);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="p-6 md:p-8" style={{ backgroundColor: "#f1f5f9", minHeight: "100vh" }}>
        <p className="text-slate-600">กำลังโหลด...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 md:p-8" style={{ backgroundColor: "#f1f5f9", minHeight: "100vh" }}>
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-800">{error}</div>
      </div>
    );
  }

  // จำนวนรายการ "จริง" (ไม่นับที่รอลบข้อมูล) เพื่อให้ตรงกับ Summary Card
  const validTotal = useMemo(
    () => rows.filter((r) => (r.approvalStatus ?? "").trim() !== "รอลบข้อมูล").length,
    [rows]
  );

  return (
    <div className="flex flex-col h-full px-6 md:px-8 pt-4" style={{ backgroundColor: "#f1f5f9" }}>
      <div className="pb-4 shrink-0 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-slate-600 text-sm whitespace-nowrap">
          รายการขอบัตรผ่านทั้งหมด {validTotal} รายการ
          {search.trim() && (
            <span className="ml-2 text-xs text-slate-500">
              (แสดงผลหลังค้นหา {filteredRows.length} รายการ)
            </span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหา"
            className="w-full md:w-80 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowOptionsMenu((v) => !v)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              title={`ตัวเลือกตาราง คอลัมน์ ${visibleCols.length}/${COLUMNS.length} · M ${activeMCount}/${paymentStatusOptions.length} · N ${activeNCount}/${approvalStatusOptions.length}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            {showOptionsMenu && (
              <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-lg p-3 max-h-96 overflow-y-auto text-sm text-slate-700">
                <div className="flex items-center justify-between px-1 pb-2 border-b border-slate-200">
                  <p className="text-xs font-medium text-slate-500">ตั้งค่าการแสดงตาราง</p>
                  <button
                    type="button"
                    onClick={() => {
                      const defaultOrder = COLUMNS.map((c) => c.key);
                      const defaultVisible: Record<ColumnKey, boolean> = {} as Record<ColumnKey, boolean>;
                      for (const col of COLUMNS) defaultVisible[col.key] = true;
                      defaultVisible.requestFor = false;
                      defaultVisible.vehicleOwner = false;
                      setColumnOrder(defaultOrder);
                      setVisibleColumns(defaultVisible);
                      setSelectedMStatuses({});
                      setSelectedNStatuses({});
                      lastSavedPayloadRef.current = "";
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    รีเซ็ตเป็นค่าเริ่มต้น
                  </button>
                </div>

                <div className="mt-2 mb-3">
                  <p className="px-1 pb-1 text-xs font-semibold text-slate-500">
                    คอลัมน์ที่ต้องการให้แสดง
                  </p>
                  <div className="space-y-1">
                    {columnOrder.map((key) => {
                      const col = COLUMNS.find((c) => c.key === key)!;
                      return (
                        <label
                          key={col.key}
                          className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-50 cursor-pointer"
                          draggable={col.key !== "rowNumber"}
                          onDragStart={handleColumnDragStart(col.key)}
                          onDragOver={handleColumnDragOver(col.key)}
                          onDrop={handleColumnDrop(col.key)}
                        >
                          <input
                            type="checkbox"
                            checked={visibleColumns[col.key] ?? true}
                            disabled={col.key === "rowNumber"}
                            onChange={() => toggleColumn(col.key)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className={`text-sm ${col.key === "rowNumber" ? "text-slate-400" : ""}`}>
                            {col.label}
                            {col.key === "rowNumber" && " (บังคับ)"}
                          </span>
                          {col.key !== "rowNumber" && (
                            <span className="ml-auto text-xs text-slate-400 cursor-grab select-none">
                              ≡
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="mb-2 border-y border-slate-200 pb-2 mt-2 pt-2">
                  <p className="px-1 pb-1 text-xs font-semibold text-slate-500">
                    การชำระเงิน <span className="font-normal text-slate-400">(ตัวกรองสถานะ M)</span>
                  </p>
                  {paymentStatusOptions.length === 0 ? (
                    <p className="px-1 text-xs text-slate-400">ไม่มีข้อมูลสถานะในรายการ</p>
                  ) : (
                    <div className="space-y-1">
                      {paymentStatusOptions.map((value) => (
                        <label
                          key={value || "(empty-m)"}
                          className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedMStatuses[value] ?? true}
                            onChange={() => toggleMStatus(value)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>{formatStatusLabel(value, "(ว่าง)")}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className="px-1 pb-1 text-xs font-semibold text-slate-500">
                    ผลการตรวจ <span className="font-normal text-slate-400">(ตัวกรองสถานะ N)</span>
                  </p>
                  {approvalStatusOptions.length === 0 ? (
                    <p className="px-1 text-xs text-slate-400">ไม่มีข้อมูลสถานะในรายการ</p>
                  ) : (
                    <div className="space-y-1">
                      {approvalStatusOptions.map((value) => (
                        <label
                          key={value || "(empty-n)"}
                          className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedNStatuses[value] ?? true}
                            onChange={() => toggleNStatus(value)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>{formatStatusLabel(value, "(ว่าง)")}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl bg-white border border-slate-200 p-8 text-center text-slate-500">
          ไม่มีข้อมูล
        </div>
      ) : (
        <div className="flex-1 min-h-0 rounded-xl bg-white border border-slate-200 shadow-sm overflow-auto">
          <table className="w-full text-sm border-collapse min-w-[1200px]">
            <colgroup>
              {visibleCols.map((col) => (
                <col key={col.key} />
              ))}
            </colgroup>
            <thead className="sticky top-0 bg-emerald-700 text-white z-10">
              <tr>
                {visibleCols.map((col) => (
                  <th
                    key={col.key}
                    className={`px-3 py-2.5 font-medium whitespace-nowrap border-b border-slate-600 text-center ${NARROW_COLUMN_KEYS.includes(col.key) ? "w-[7rem] min-w-[7rem] max-w-[7rem]" : ""}`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r, rowIdx) => (
                <tr key={r.rowNumber} className="border-b border-slate-200 hover:bg-slate-50">
                  {visibleCols.map((col) => {
                    const value = col.key === "rowNumber" ? String(rowIdx + 1) : getCellValue(r, col.key);
                    const isPlate = col.key === "plate";
                    const isPayment = col.key === "paymentStatus";
                    const isCheckedAt = col.key === "checkedAt";
                    const isCardNumber = col.key === "columnP";
                    const note = r.note || "";
                    const hasLink = isPlate && note && (note.startsWith("http") || note.startsWith("https"));
                    const isNarrow = NARROW_COLUMN_KEYS.includes(col.key);
                    return (
                      <td
                        key={`${r.rowNumber}-${col.key}`}
                        className={`px-3 py-2 text-slate-700 whitespace-nowrap ${col.key === "rowNumber" ? "text-center" : isCheckedAt ? "text-right" : ""} ${isNarrow ? "w-[7rem] min-w-[7rem] max-w-[7rem] truncate" : isCardNumber ? "" : "max-w-[200px] truncate"}`}
                        title={isCardNumber ? undefined : value}
                      >
                        {isCardNumber ? (
                          editingRow === r.rowNumber ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="flex-1 min-w-0 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                disabled={saving}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleNoteSave(r.rowNumber);
                                  if (e.key === "Escape") handleNoteCancel();
                                }}
                              />
                              <button
                                onClick={() => handleNoteSave(r.rowNumber)}
                                disabled={saving}
                                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                              >
                                {saving ? "..." : "บันทึก"}
                              </button>
                              <button
                                onClick={handleNoteCancel}
                                disabled={saving}
                                className="px-2 py-1 text-xs bg-slate-200 text-slate-700 rounded hover:bg-slate-300 disabled:opacity-50"
                              >
                                ยกเลิก
                              </button>
                            </div>
                          ) : (
                            <div
                              onClick={() => handleEditClick(r.rowNumber, r.columnP ?? "")}
                              className="cursor-pointer text-slate-600 hover:text-blue-600 hover:underline min-h-[1.5rem]"
                              title="คลิกเพื่อแก้ไข"
                            >
                              {r.columnP || <span className="text-slate-400 text-xs">แก้ไข</span>}
                            </div>
                          )
                        ) : hasLink ? (
                          <a href={note} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                            {value}
                          </a>
                        ) : (
                          <span
                            className={
                              isPayment && value.includes("ค้าง")
                                ? "text-red-600 font-medium"
                                : isPayment && value.includes("ชำระเงินแล้ว")
                                  ? "text-emerald-600 font-medium"
                                  : col.key === "approvalStatus" && value.includes("ข้อมูลไม่ถูกต้อง")
                                    ? "text-red-600 font-medium"
                                    : col.key === "approvalStatus" &&
                                      (value.includes("รับบัตรเรียบร้อย") ||
                                        value.includes("รออนุมัติจาก ฝขว.พล.ป.") ||
                                        value.includes("รอส่ง ฝขว.พล.ป."))
                                      ? "text-emerald-600 font-medium"
                                      : ""
                            }
                          >
                            {value}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
