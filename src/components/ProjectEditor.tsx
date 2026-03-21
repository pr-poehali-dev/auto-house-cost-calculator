import { useState } from "react";
import Icon from "@/components/ui/icon";
import FileGallery from "./project-editor/FileGallery";
import SpecEditor from "./project-editor/SpecEditor";
import DocUploadManager from "./project-editor/DocUploadManager";
import type { Project } from "./project-editor/types";
import type { AiItem } from "@/pages/staff/materials-types";

export default function ProjectPanel({ project, token, role, onClose }: {
  project: Project; token: string; role: string; onClose: () => void
}) {
  const [tab, setTab] = useState<"gallery" | "docs" | "spec">("gallery");
  const [importedItems, setImportedItems] = useState<AiItem[] | null>(null);
  const canEdit = role === "architect" || role === "constructor";

  const handleDocImport = (items: AiItem[], _category: string) => {
    setImportedItems(items);
    setTab("spec");
  };

  const tabs = [
    { id: "gallery", label: "Медиафайлы", icon: "Images" },
    { id: "docs", label: "Документация", icon: "FolderOpen" },
    { id: "spec", label: "Ведомость", icon: "ClipboardList" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      style={{ background: "rgba(0,0,0,0.8)" }}
      onClick={onClose}>
      <div className="w-full sm:max-w-5xl sm:max-h-[90vh] flex flex-col rounded-none sm:rounded-2xl overflow-hidden"
        style={{ background: "var(--dark-bg)", border: "1px solid var(--card-border)" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--card-border)", background: "rgba(255,255,255,0.02)" }}>
          <div>
            <div className="font-display font-bold text-xl text-white">{project.name}</div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
              {project.type} · {project.area} м² · {project.floors} эт. · {project.rooms} комн.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex p-1 rounded-xl gap-1" style={{ background: "rgba(255,255,255,0.05)" }}>
              {tabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id as "gallery" | "docs" | "spec")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: tab === t.id ? "var(--neon-orange)" : "transparent",
                    color: tab === t.id ? "#fff" : "rgba(255,255,255,0.5)",
                  }}>
                  <Icon name={t.icon} size={13} />{t.label}
                  {t.id === "spec" && importedItems && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold"
                      style={{ background: "rgba(0,255,136,0.2)", color: "var(--neon-green)" }}>
                      {importedItems.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="p-2 rounded-lg transition-all hover:bg-white/10"
              style={{ color: "rgba(255,255,255,0.5)" }}>
              <Icon name="X" size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === "gallery" && <FileGallery project={project} token={token} canEdit={canEdit} />}
          {tab === "docs" && (
            <DocUploadManager
              token={token}
              projectId={project.id}
              onImport={handleDocImport}
            />
          )}
          {tab === "spec" && (
            <SpecEditor
              project={project}
              token={token}
              role={role}
              pendingImport={importedItems}
              onPendingImportClear={() => setImportedItems(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}