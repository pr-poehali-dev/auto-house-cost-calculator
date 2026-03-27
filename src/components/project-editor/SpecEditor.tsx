import { useState, useEffect, useCallback } from "react";
import { PROJECTS_URL, DEFAULT_SECTIONS, fmt, authFetch } from "./types";
import type { Project, Spec, SpecItem, HistoryEntry } from "./types";
import type { AiItem } from "@/pages/staff/materials-types";
import SpecImportBanner from "./SpecImportBanner";
import SpecToolbar from "./SpecToolbar";
import SpecItemsTable from "./SpecItemsTable";
import SpecHistoryModal from "./SpecHistoryModal";

export default function SpecEditor({ project, token, role, pendingImport, onPendingImportClear }: {
  project: Project; token: string; role: string;
  pendingImport?: AiItem[] | null;
  onPendingImportClear?: () => void;
}) {
  const [spec, setSpec] = useState<Spec | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [editingCell, setEditingCell] = useState<{ id: number; field: string } | null>(null);
  const [newItemSection, setNewItemSection] = useState(DEFAULT_SECTIONS[0]);
  const [msg, setMsg] = useState("");
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [importBanner, setImportBanner] = useState(false);

  const canEdit = role === "architect" || role === "constructor";

  const loadSpec = useCallback(async () => {
    setLoading(true);
    const res = await authFetch(`${PROJECTS_URL}?action=spec_get`, { method: "POST", body: JSON.stringify({ project_id: project.id }) }, token);
    setSpec(res.spec || null);
    setLoading(false);
  }, [project.id, token]);

  useEffect(() => { loadSpec(); }, [loadSpec]);

  useEffect(() => {
    if (pendingImport && pendingImport.length > 0) setImportBanner(true);
  }, [pendingImport]);

  const createSpec = async () => {
    const res = await authFetch(`${PROJECTS_URL}?action=spec_create`, {
      method: "POST",
      body: JSON.stringify({ project_id: project.id, items: [] }),
    }, token);
    if (res.ok) loadSpec();
  };

  const importItems = async (items: AiItem[]) => {
    let specId = spec?.id;
    if (!specId) {
      const res = await authFetch(`${PROJECTS_URL}?action=spec_create`, {
        method: "POST",
        body: JSON.stringify({ project_id: project.id, items: [] }),
      }, token);
      if (!res.ok || !res.spec_id) return;
      specId = res.spec_id;
    }
    let added = 0;
    for (const item of items) {
      const r = await authFetch(`${PROJECTS_URL}?action=spec_add_item`, {
        method: "POST",
        body: JSON.stringify({
          spec_id: specId,
          section: item.section || "Прочее",
          name: item.name,
          unit: item.unit || "шт",
          qty: item.qty || 0,
          price_per_unit: item.price_per_unit || 0,
          note: item.note || "",
        }),
      }, token);
      if (r.ok) added++;
    }
    setMsg(`Импортировано ${added} позиций из документа`);
    setImportBanner(false);
    onPendingImportClear?.();
    loadSpec();
  };

  const updateItem = async (item: SpecItem, field: string, value: string | number) => {
    setSaving(item.id);
    await authFetch(`${PROJECTS_URL}?action=spec_update_item`, {
      method: "POST",
      body: JSON.stringify({ item_id: item.id, spec_id: spec?.id, [field]: value }),
    }, token);
    setSaving(null);
    setEditingCell(null);
    setSpec(prev => prev ? {
      ...prev,
      items: prev.items.map(i => i.id === item.id ? {
        ...i,
        [field]: value,
        total_price: field === "qty" ? Number(value) * i.price_per_unit : field === "price_per_unit" ? i.qty * Number(value) : i.total_price,
      } : i),
    } : null);
  };

  const addItem = async () => {
    if (!spec) return;
    const res = await authFetch(`${PROJECTS_URL}?action=spec_add_item`, {
      method: "POST",
      body: JSON.stringify({ spec_id: spec.id, section: newItemSection, name: "Новая позиция", unit: "шт", qty: 1, price_per_unit: 0 }),
    }, token);
    if (res.ok) { setMsg("Позиция добавлена"); loadSpec(); }
  };

  const deleteItem = async (itemId: number) => {
    if (!confirm("Удалить позицию?")) return;
    await authFetch(`${PROJECTS_URL}?action=spec_delete_item`, {
      method: "POST",
      body: JSON.stringify({ item_id: itemId }),
    }, token);
    setSpec(prev => prev ? { ...prev, items: prev.items.filter(i => i.id !== itemId) } : null);
  };

  const approve = async () => {
    if (!spec) return;
    await authFetch(`${PROJECTS_URL}?action=spec_approve`, {
      method: "POST",
      body: JSON.stringify({ spec_id: spec.id }),
    }, token);
    setMsg("Ведомость утверждена!");
    loadSpec();
  };

  const loadHistory = async () => {
    if (!spec) return;
    const res = await authFetch(`${PROJECTS_URL}?action=spec_history&spec_id=${spec.id}`, {}, token);
    setHistory(res.history || []);
    setShowHistory(true);
  };

  const printSpec = () => {
    if (!spec) return;
    const sections = Array.from(new Set(spec.items.map(i => i.section)));
    const grandTotal = spec.items.reduce((s, i) => s + i.total_price, 0);
    const date = new Date().toLocaleDateString("ru-RU");

    const sectionRows = sections.map(section => {
      const items = spec.items.filter(i => i.section === section);
      const sTotal = items.reduce((s, i) => s + i.total_price, 0);
      return `
        <tr class="section-header">
          <td colspan="6">${section}</td>
        </tr>
        ${items.map((item, idx) => `
          <tr class="${idx % 2 ? 'row-even' : ''}">
            <td>${item.name}</td>
            <td class="center">${item.unit}</td>
            <td class="right">${fmt(item.qty)}</td>
            <td class="right">${fmt(item.price_per_unit)}</td>
            <td class="right bold">${fmt(item.total_price)}</td>
            <td>${item.note || ''}</td>
          </tr>
        `).join('')}
        <tr class="section-total">
          <td colspan="4" class="right">Итого по разделу «${section}»:</td>
          <td class="right bold">${fmt(sTotal)}</td>
          <td></td>
        </tr>
      `;
    }).join('');

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>ВОР — ${project.name}</title>
<style>
  @page { size: A4 landscape; margin: 12mm 10mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a1a1a; }
  .header { margin-bottom: 16px; border-bottom: 2px solid #333; padding-bottom: 10px; }
  .header h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
  .header .meta { font-size: 11px; color: #555; }
  .header .meta span { margin-right: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f0f0f0; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;
       padding: 6px 8px; border: 1px solid #ccc; text-align: left; font-weight: 700; }
  td { padding: 5px 8px; border: 1px solid #ddd; font-size: 11px; vertical-align: top; }
  .section-header td { background: #e8e8e8; font-weight: 700; font-size: 11px; padding: 6px 8px; }
  .section-total td { background: #f5f5f5; font-size: 11px; border-top: 2px solid #bbb; }
  .row-even td { background: #fafafa; }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: 700; }
  .grand-total { margin-top: 12px; padding: 10px; text-align: right; font-size: 16px; font-weight: 700;
                 border-top: 3px solid #333; }
  .signatures { margin-top: 40px; display: flex; gap: 60px; }
  .sig-block { flex: 1; border-top: 1px solid #333; padding-top: 4px; font-size: 10px; color: #555; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head><body>
<div class="header">
  <h1>ВЕДОМОСТЬ ОБЪЁМОВ РАБОТ</h1>
  <div class="meta">
    <span>Проект: <b>${project.name}</b></span>
    <span>Площадь: <b>${project.area} м²</b></span>
    <span>Этажей: <b>${project.floors}</b></span>
    <span>Тип: <b>${project.type}</b></span>
    <span>Версия: <b>${spec.version}</b></span>
    <span>Статус: <b>${spec.status === "approved" ? "Утверждена" : "Черновик"}</b></span>
    <span>Дата: <b>${date}</b></span>
  </div>
</div>
<table>
  <thead>
    <tr>
      <th style="width:35%">Наименование</th>
      <th style="width:7%" class="center">Ед. изм.</th>
      <th style="width:10%" class="right">Кол-во</th>
      <th style="width:13%" class="right">Цена/ед., ₽</th>
      <th style="width:13%" class="right">Сумма, ₽</th>
      <th style="width:22%">Примечание</th>
    </tr>
  </thead>
  <tbody>
    ${sectionRows}
  </tbody>
</table>
<div class="grand-total">ИТОГО: ${fmt(grandTotal)} ₽</div>
<div class="signatures">
  <div class="sig-block">Составил (архитектор): _______________</div>
  <div class="sig-block">Проверил: _______________</div>
  <div class="sig-block">Утвердил: _______________</div>
</div>
<script>window.onload=function(){window.print()}</script>
</body></html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  const downloadPDF = async () => {
    if (!spec) return;
    setGeneratingPDF(true);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      doc.setFillColor(10, 13, 20);
      doc.rect(0, 0, 297, 210, "F");
      doc.setFontSize(16); doc.setTextColor(255, 107, 26);
      doc.text(`ВЕДОМОСТЬ ОБЪЁМОВ РАБОТ`, 14, 16);
      doc.setFontSize(10); doc.setTextColor(180, 180, 180);
      doc.text(`Проект: ${project.name} · ${project.area} м² · ${project.floors} эт. · ${project.type}`, 14, 24);
      doc.text(`Версия: ${spec.version} · Статус: ${spec.status === "approved" ? "Утверждена" : "Черновик"} · Дата: ${new Date().toLocaleDateString("ru-RU")}`, 14, 30);

      const sections = Array.from(new Set(spec.items.map(i => i.section)));
      let startY = 36;

      for (const section of sections) {
        const sectionItems = spec.items.filter(i => i.section === section);
        const sTotal = sectionItems.reduce((s, i) => s + i.total_price, 0);

        doc.setFillColor(30, 37, 53);
        doc.rect(14, startY, 269, 6, "F");
        doc.setFontSize(8); doc.setTextColor(255, 107, 26);
        doc.text(`${section.toUpperCase()}`, 16, startY + 4.2);
        startY += 7;

        autoTable(doc, {
          startY,
          head: [["Наименование", "Ед.", "Кол-во", "Цена/ед., ₽", "Сумма, ₽", "Примечание"]],
          body: [
            ...sectionItems.map(item => [
              item.name, item.unit, String(item.qty),
              fmt(item.price_per_unit), fmt(item.total_price), item.note || "",
            ]),
            ["", "", "", "Итого по разделу:", fmt(sTotal), ""],
          ],
          theme: "grid",
          styles: { fontSize: 7, cellPadding: 1.5, textColor: [220, 220, 220], fillColor: [15, 19, 30], lineColor: [30, 37, 53] },
          headStyles: { fillColor: [20, 26, 40], textColor: [0, 212, 255], fontStyle: "bold", fontSize: 7 },
          footStyles: { fillColor: [20, 26, 40], textColor: [0, 255, 136], fontStyle: "bold" },
          columnStyles: {
            0: { cellWidth: 80 }, 1: { cellWidth: 15, halign: "center" },
            2: { cellWidth: 20, halign: "right" }, 3: { cellWidth: 30, halign: "right" },
            4: { cellWidth: 30, halign: "right" }, 5: { cellWidth: "auto" },
          },
          margin: { left: 14, right: 14 },
          didParseCell: (data) => {
            if (data.row.index === sectionItems.length) {
              data.cell.styles.fillColor = [20, 26, 40];
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.textColor = [0, 255, 136];
            }
          },
        });
        startY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
      }

      const grandTotal = spec.items.reduce((s, i) => s + i.total_price, 0);
      doc.setFontSize(13); doc.setTextColor(255, 107, 26);
      doc.text(`ИТОГО: ${fmt(grandTotal)} руб.`, 14, startY + 8);

      doc.save(`vedomost_${project.name}_v${spec.version}.pdf`);
    } catch (e) {
      setMsg("Ошибка генерации PDF");
    }
    setGeneratingPDF(false);
  };

  if (loading) return <div className="text-center py-10" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка...</div>;

  if (!spec) {
    return (
      <div className="text-center py-10 rounded-2xl" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
        <div className="text-4xl mb-3">📋</div>
        <div className="font-display text-lg text-white mb-1">Ведомость не создана</div>
        <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
          {canEdit ? "Создайте ведомость объёмов работ для этого проекта" : "Ведомость ещё не создана архитектором или конструктором"}
        </p>
        {canEdit && (
          <button onClick={createSpec}
            className="px-6 py-3 rounded-xl text-sm font-semibold"
            style={{ background: "var(--neon-orange)", color: "#fff" }}>
            Создать ведомость
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {importBanner && pendingImport && pendingImport.length > 0 && (
        <SpecImportBanner
          pendingImport={pendingImport}
          onImport={importItems}
          onCancel={() => { setImportBanner(false); onPendingImportClear?.(); }}
        />
      )}

      <SpecToolbar
        spec={spec}
        canEdit={canEdit}
        generatingPDF={generatingPDF}
        onHistory={loadHistory}
        onApprove={approve}
        onPrint={printSpec}
        onPDF={downloadPDF}
      />

      {msg && <div className="mb-3 px-3 py-2 rounded-lg text-sm" style={{ background: "rgba(0,255,136,0.08)", color: "var(--neon-green)" }}>{msg}</div>}

      <SpecItemsTable
        spec={spec}
        canEdit={canEdit}
        saving={saving}
        editingCell={editingCell}
        newItemSection={newItemSection}
        onEditCell={setEditingCell}
        onUpdateItem={updateItem}
        onDeleteItem={deleteItem}
        onAddItem={addItem}
        onSectionChange={setNewItemSection}
      />

      {showHistory && (
        <SpecHistoryModal
          history={history}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}
