import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import ChatWidget from "@/components/ChatWidget";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import CalcTab from "./index/CalcTab";
import { ProjectsTab, CompareTab, SmetaTab } from "./index/ProjectsCompareTab";
import {
  HOUSE_TYPES, ROOF_TYPES, FOUNDATION_TYPES, FINISHING,
  COMMUNICATIONS, ADDITIONAL, buildSmeta, formatNum,
  NAV_ITEMS, BASE_PRICE_PER_SQM,
} from "./index/data";

export default function Index() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("calc");

  // Calculator state
  const [area, setArea] = useState(120);
  const [floors, setFloors] = useState(2);
  const [houseType, setHouseType] = useState("brick");
  const [roofType, setRoofType] = useState("gable");
  const [foundation, setFoundation] = useState("tape");
  const [finishing, setFinishing] = useState("standard");
  const [communications, setCommunications] = useState<string[]>(["electricity", "water", "sewage"]);
  const [additionals, setAdditionals] = useState<string[]>([]);
  const [region, setRegion] = useState(1.0);
  const [animKey, setAnimKey] = useState(0);

  // Projects state
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [compareList, setCompareList] = useState<number[]>([]);

  // Calculation
  const houseTypeData = HOUSE_TYPES.find(h => h.id === houseType)!;
  const roofData = ROOF_TYPES.find(r => r.id === roofType)!;
  const foundationData = FOUNDATION_TYPES.find(f => f.id === foundation)!;
  const finishingData = FINISHING.find(f => f.id === finishing)!;

  const baseConstruction = area * BASE_PRICE_PER_SQM * houseTypeData.multiplier * floors * 0.85 * region;
  const roofCost = area * roofData.price * roofData.multiplier;
  const foundationCost = area * foundationData.price;
  const finishingCost = baseConstruction * finishingData.multiplier;
  const commsCost = communications.reduce((sum, id) => sum + (COMMUNICATIONS.find(c => c.id === id)?.price || 0), 0);
  const additionalCost = additionals.reduce((sum, id) => sum + (ADDITIONAL.find(a => a.id === id)?.price || 0), 0);
  const totalCost = baseConstruction + roofCost + foundationCost + finishingCost + commsCost + additionalCost;

  const toggleComm = (id: string) =>
    setCommunications(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleAdditional = (id: string) =>
    setAdditionals(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleCompare = (id: number) =>
    setCompareList(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 3 ? [...prev, id] : prev);

  useEffect(() => {
    setAnimKey(k => k + 1);
  }, [area, floors, houseType, roofType, foundation, finishing, communications, additionals, region]);

  // Smeta PDF
  const downloadPDF = () => {
    const smetaGroups = buildSmeta(area, floors, finishing);
    const smetaTotal = smetaGroups.reduce((s, g) => s + g.groupTotal, 0);
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    doc.setFillColor(10, 13, 20);
    doc.rect(0, 0, 210, 297, "F");
    doc.setFontSize(20);
    doc.setTextColor(255, 107, 26);
    doc.text("СМЕТА НА СТРОИТЕЛЬСТВО ДОМА", 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(180, 180, 180);
    doc.text(`Дата: ${new Date().toLocaleDateString("ru-RU")}`, 14, 26);
    doc.text(`Площадь: ${area} м²  |  Этажей: ${floors}  |  Тип: ${houseTypeData.label}  |  Отделка: ${finishingData.label}`, 14, 32);

    let startY = 40;

    for (const group of smetaGroups) {
      doc.setFillColor(30, 37, 53);
      doc.rect(14, startY - 4, 182, 7, "F");
      doc.setFontSize(9);
      doc.setTextColor(255, 107, 26);
      doc.text(group.category.toUpperCase(), 16, startY);
      startY += 4;

      autoTable(doc, {
        startY,
        head: [["Наименование", "Ед.", "Кол-во", "Цена/ед.", "Сумма, ₽"]],
        body: group.items.map(item => [
          item.name,
          item.unit,
          String(item.totalQty),
          formatNum(item.pricePerUnit),
          formatNum(item.totalPrice),
        ]),
        foot: [["", "", "", "Итого по разделу:", formatNum(group.groupTotal)]],
        theme: "grid",
        styles: { fontSize: 7.5, cellPadding: 2, textColor: [220, 220, 220], fillColor: [15, 19, 30], lineColor: [30, 37, 53] },
        headStyles: { fillColor: [20, 26, 40], textColor: [0, 212, 255], fontStyle: "bold", fontSize: 7.5 },
        footStyles: { fillColor: [20, 26, 40], textColor: [0, 255, 136], fontStyle: "bold", fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 15, halign: "center" },
          2: { cellWidth: 20, halign: "right" },
          3: { cellWidth: 32, halign: "right" },
          4: { cellWidth: 32, halign: "right" },
        },
        margin: { left: 14, right: 14 },
      });

      startY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    }

    doc.setFontSize(13);
    doc.setTextColor(255, 107, 26);
    doc.text(`ИТОГО ПО СМЕТЕ: ${formatNum(smetaTotal)} руб.`, 14, startY + 6);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("* Смета носит ориентировочный характер. Цены могут отличаться в зависимости от региона и поставщиков.", 14, startY + 14);

    doc.save(`smeta_${area}m2_${floors}fl.pdf`);
  };

  return (
    <div className="noise-bg min-h-screen" style={{ background: "var(--dark-bg)" }}>
      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, var(--neon-orange) 0%, transparent 70%)" }} />
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full opacity-8"
          style={{ background: "radial-gradient(circle, var(--neon-cyan) 0%, transparent 70%)" }} />
        <div className="absolute top-[40%] left-[50%] w-[400px] h-[400px] rounded-full opacity-5"
          style={{ background: "radial-gradient(circle, #A855F7 0%, transparent 70%)" }} />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5"
        style={{ background: "rgba(10,13,20,0.92)", backdropFilter: "blur(20px)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center font-display font-bold text-sm"
              style={{ background: "linear-gradient(135deg, var(--neon-orange), #FF3D00)", color: "#fff" }}>
              СК
            </div>
            <div>
              <div className="font-display font-semibold text-base tracking-wide text-white">СтройКалькулятор</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Автоматический расчёт</div>
            </div>
          </div>

          <nav className="hidden sm:flex items-center gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.05)" }}>
            {NAV_ITEMS.map(item => (
              <button key={item.id} onClick={() => setActiveTab(item.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                style={{
                  background: activeTab === item.id ? "var(--neon-orange)" : "transparent",
                  color: activeTab === item.id ? "#fff" : "rgba(255,255,255,0.5)",
                  boxShadow: activeTab === item.id ? "0 0 20px rgba(255,107,26,0.35)" : "none",
                }}>
                <Icon name={item.icon} size={15} />
                {item.label}
                {item.id === "compare" && compareList.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold"
                    style={{ background: activeTab === "compare" ? "rgba(255,255,255,0.3)" : "var(--neon-orange)", color: "#fff", fontSize: 10 }}>
                    {compareList.length}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="sm:hidden flex gap-1">
              {NAV_ITEMS.map(item => (
                <button key={item.id} onClick={() => setActiveTab(item.id)}
                  className="p-2 rounded-lg transition-all"
                  style={{ background: activeTab === item.id ? "var(--neon-orange)" : "rgba(255,255,255,0.05)", color: "#fff" }}>
                  <Icon name={item.icon} size={18} />
                </button>
              ))}
            </div>
            <button onClick={() => navigate("/project-builder")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
              style={{ background: "rgba(0,255,136,0.12)", color: "var(--neon-green)", border: "1px solid rgba(0,255,136,0.25)" }}
              title="Создать проект с AI">
              <Icon name="Sparkles" size={13} />
              <span className="hidden sm:inline">Создать свой проект</span>
            </button>
            <button onClick={() => navigate("/supplier")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
              style={{ background: "rgba(168,85,247,0.12)", color: "#A855F7", border: "1px solid rgba(168,85,247,0.25)" }}
              title="Портал поставщиков">
              <Icon name="Truck" size={13} />
              <span className="hidden sm:inline">Поставщикам</span>
            </button>
            <button onClick={() => navigate("/staff")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all hover:bg-white/10"
              style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)" }}
              title="Личный кабинет сотрудника">
              <Icon name="Users" size={13} />
              <span className="hidden sm:inline">Сотрудники</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {activeTab === "calc" && (
          <CalcTab
            area={area} setArea={setArea}
            floors={floors} setFloors={setFloors}
            houseType={houseType} setHouseType={setHouseType}
            roofType={roofType} setRoofType={setRoofType}
            foundation={foundation} setFoundation={setFoundation}
            finishing={finishing} setFinishing={setFinishing}
            communications={communications} toggleComm={toggleComm}
            additionals={additionals} toggleAdditional={toggleAdditional}
            region={region} setRegion={setRegion}
            animKey={animKey}
            totalCost={totalCost}
            baseConstruction={baseConstruction}
            roofCost={roofCost}
            foundationCost={foundationCost}
            finishingCost={finishingCost}
            commsCost={commsCost}
            additionalCost={additionalCost}
          />
        )}

        {activeTab === "projects" && (
          <ProjectsTab
            selectedProject={selectedProject}
            setSelectedProject={setSelectedProject}
            compareList={compareList}
            toggleCompare={toggleCompare}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === "compare" && (
          <CompareTab
            compareList={compareList}
            toggleCompare={toggleCompare}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === "smeta" && (
          <SmetaTab
            area={area}
            floors={floors}
            finishing={finishing}
            houseTypeLabel={houseTypeData.label}
            finishingLabel={finishingData.label}
            onDownloadPDF={downloadPDF}
          />
        )}

      </main>

      {/* Footer */}
      <footer className="mt-16 border-t py-8 text-center"
        style={{ borderColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.25)", fontSize: 12 }}>
        СтройКалькулятор · Автоматический расчёт стоимости строительства · 2026
      </footer>

      <ChatWidget role="visitor" />
    </div>
  );
}