import { useState, useCallback, useRef } from "react";
import Icon from "@/components/ui/icon";
import { PROJECTS_URL, FILE_TYPES, authFetch } from "./types";
import type { Project, ProjectFile } from "./types";

const CHUNK_SIZE = 3 * 1024 * 1024;

export default function FileGallery({ project, token, canEdit }: { project: Project; token: string; canEdit: boolean }) {
  const [files, setFiles] = useState<ProjectFile[]>(project.files || []);
  const [activeType, setActiveType] = useState("render");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await authFetch(`${PROJECTS_URL}?action=get`, { method: "POST", body: JSON.stringify({ project_id: project.id }) }, token);
    if (res.project?.files) setFiles(res.project.files);
  }, [project.id, token]);

  const uploadFile = async (file: File, ftype: string) => {
    setUploading(true); setProgress(0);
    try {
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      let uploadId = "";
      let parts: { PartNumber: number; ETag: string }[] = [];
      let cdnUrl = "";

      for (let i = 0; i < totalChunks; i++) {
        const slice = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const arrayBuf = await slice.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        let b64 = "";
        for (let j = 0; j < bytes.length; j += 1024) {
          b64 += String.fromCharCode(...bytes.subarray(j, j + 1024));
        }
        b64 = btoa(b64);

        const r = await authFetch(`${PROJECTS_URL}?action=upload_file`, {
          method: "POST",
          body: JSON.stringify({
            project_id: project.id, file_name: file.name, file_type: ftype,
            chunk: b64, chunk_index: i, total_chunks: totalChunks,
            upload_id: uploadId, parts,
          }),
        }, token);

        if (!r.ok) break;
        if (r.upload_id) uploadId = r.upload_id;
        if (r.parts) parts = r.parts;
        setProgress(Math.round(((i + 1) / totalChunks) * 100));
        if (r.done) { cdnUrl = r.cdn_url; break; }
      }

      if (cdnUrl) {
        await authFetch(`${PROJECTS_URL}?action=confirm_upload`, {
          method: "POST",
          body: JSON.stringify({ project_id: project.id, file_name: file.name, file_type: ftype, cdn_url: cdnUrl }),
        }, token);
        load();
      }
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (fid: number) => {
    if (!confirm("Удалить файл?")) return;
    await authFetch(`${PROJECTS_URL}?action=delete_file`, { method: "POST", body: JSON.stringify({ file_id: fid }) }, token);
    load();
  };

  const byType = (t: string) => files.filter(f => f.file_type === t);

  return (
    <div>
      {/* Type tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {FILE_TYPES.map(t => {
          const count = byType(t.id).length;
          return (
            <button key={t.id} onClick={() => setActiveType(t.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
              style={{
                background: activeType === t.id ? "var(--neon-cyan)" : "rgba(255,255,255,0.06)",
                color: activeType === t.id ? "#000" : "rgba(255,255,255,0.6)",
                border: activeType === t.id ? "none" : "1px solid rgba(255,255,255,0.08)",
              }}>
              <span>{t.icon}</span>{t.label}
              {count > 0 && (
                <span className="ml-0.5 font-bold px-1.5 py-0.5 rounded-full text-xs"
                  style={{ background: activeType === t.id ? "rgba(0,0,0,0.2)" : "rgba(0,212,255,0.2)", color: activeType === t.id ? "#000" : "var(--neon-cyan)" }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Upload zone */}
      {canEdit && (
        <div
          className="border-2 border-dashed rounded-2xl p-6 text-center mb-4 cursor-pointer transition-all hover:bg-white/5"
          style={{ borderColor: uploading ? "var(--neon-cyan)" : "rgba(255,255,255,0.1)" }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); Array.from(e.dataTransfer.files).forEach(f => uploadFile(f, activeType)); }}>
          <input ref={fileInputRef} type="file" className="hidden" multiple
            accept={FILE_TYPES.find(t => t.id === activeType)?.accept}
            onChange={e => Array.from(e.target.files || []).forEach(f => uploadFile(f, activeType))} />
          {uploading ? (
            <div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-5 h-5 border-2 border-white/20 rounded-full animate-spin" style={{ borderTopColor: "var(--neon-cyan)" }} />
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>Загрузка... {progress}%</span>
              </div>
              <div className="w-full rounded-full overflow-hidden mx-auto" style={{ height: 3, background: "rgba(255,255,255,0.08)", maxWidth: 200 }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: "var(--neon-cyan)" }} />
              </div>
            </div>
          ) : (
            <>
              <Icon name="Upload" size={20} style={{ color: "rgba(255,255,255,0.3)", margin: "0 auto 8px" }} />
              <div className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                Перетащите файлы или нажмите для загрузки
              </div>
              <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>
                {FILE_TYPES.find(t => t.id === activeType)?.label} · до 4 файлов рекомендуется
              </div>
            </>
          )}
        </div>
      )}

      {/* Files grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {byType(activeType).map(f => {
          const isImg = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.file_url);
          return (
            <div key={f.id} className="relative rounded-xl overflow-hidden group"
              style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", aspectRatio: "4/3" }}>
              {isImg ? (
                <img src={f.file_url} alt={f.file_name} className="w-full h-full object-cover cursor-pointer"
                  onClick={() => setLightbox(f.file_url)} />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center cursor-pointer"
                  onClick={() => window.open(f.file_url, "_blank")}>
                  <Icon name="FileText" size={28} style={{ color: "var(--neon-cyan)" }} />
                  <div className="text-xs mt-2 px-2 text-center truncate" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {f.file_name}
                  </div>
                </div>
              )}
              {/* Overlay */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-2"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)" }}>
                <span className="text-xs text-white truncate">{f.file_name}</span>
                {canEdit && (
                  <button onClick={() => deleteFile(f.id)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(239,68,68,0.8)" }}>
                    <Icon name="X" size={11} style={{ color: "#fff" }} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {byType(activeType).length === 0 && !canEdit && (
          <div className="col-span-4 text-center py-8" style={{ color: "rgba(255,255,255,0.3)" }}>
            Файлы этого типа не загружены
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in"
          style={{ background: "rgba(0,0,0,0.9)" }}
          onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-xl object-contain" />
          <button className="absolute top-4 right-4 w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.1)", color: "#fff" }}>
            <Icon name="X" size={18} />
          </button>
        </div>
      )}
    </div>
  );
}