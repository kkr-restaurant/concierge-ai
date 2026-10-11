"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, Trash2, Download } from "lucide-react";
import BusinessSidebar from "@/app/_components/BusinessSidebar";

type Doc = {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

const MAX_SIZE_MB = 10;
const ACCEPTED =
  ".pdf,.doc,.docx,.txt,.md,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function KnowledgeBasePage() {
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/v1/tenants/documents");
    if (res.status === 401) {
      router.replace("/login");
      return;
    }
    if (res.status === 404) {
      router.replace("/signup");
      return;
    }
    if (res.ok) {
      const data = await res.json();
      setDocs(data.documents);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function uploadFile(file: File) {
    setError(null);
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`${file.name} is over ${MAX_SIZE_MB}MB — not uploaded.`);
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/v1/tenants/documents", { method: "POST", body: formData });
    setUploading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(
        body?.error === "unsupported_type"
          ? `${file.name}: file type not supported.`
          : `Couldn't upload ${file.name} — try again.`
      );
      return;
    }

    showToast(`${file.name} uploaded.`);
    load();
  }

  async function handleDelete(doc: Doc) {
    if (!confirm(`Delete ${doc.file_name}? This can't be undone.`)) return;
    const res = await fetch(`/api/v1/tenants/documents/${doc.id}`, { method: "DELETE" });
    if (!res.ok) {
      showToast("Couldn't delete — try again.");
      return;
    }
    showToast(`${doc.file_name} deleted.`);
    load();
  }

  async function handleDownload(doc: Doc) {
    const res = await fetch(`/api/v1/tenants/documents/${doc.id}`);
    if (!res.ok) {
      showToast("Couldn't get a download link.");
      return;
    }
    const data = await res.json();
    window.open(data.url, "_blank");
  }

  return (
    <div className="flex min-h-screen bg-ink text-fg">
      <BusinessSidebar current="/knowledge-base" />
      <main className="flex-1 p-8 max-w-2xl">
        <h1 className="font-display text-xl font-medium mb-1">Knowledge Base</h1>
        <p className="text-muted text-sm mb-6">
          Upload documents — menus, policies, FAQs. PDF, Word, text, markdown, or CSV, up to{" "}
          {MAX_SIZE_MB}MB each.
        </p>

        {error && (
          <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-md px-3 py-2 mb-4">
            {error}
          </div>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) uploadFile(file);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-md p-8 text-center cursor-pointer mb-6 transition-colors ${
            dragOver ? "border-brass bg-brass/5" : "border-border"
          }`}
        >
          <Upload size={22} className="mx-auto mb-2 text-muted" />
          <p className="text-sm text-muted">
            {uploading ? "Uploading…" : "Drag & drop a file here, or click to browse"}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadFile(file);
              e.target.value = "";
            }}
          />
        </div>

        {loading ? (
          <p className="text-muted text-sm">Loading…</p>
        ) : docs.length === 0 ? (
          <p className="text-muted text-sm text-center py-6">No documents uploaded yet.</p>
        ) : (
          <div className="bg-surface border border-border rounded-card overflow-hidden">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText size={16} className="text-brass flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm truncate">{doc.file_name}</p>
                    <p className="text-xs text-muted">
                      {formatSize(doc.size_bytes)} · {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button
                    onClick={() => handleDownload(doc)}
                    className="text-muted hover:text-fg"
                    aria-label={`Download ${doc.file_name}`}
                  >
                    <Download size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(doc)}
                    className="text-muted hover:text-danger"
                    aria-label={`Delete ${doc.file_name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-surface2 border border-border rounded-md px-4 py-2.5 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
