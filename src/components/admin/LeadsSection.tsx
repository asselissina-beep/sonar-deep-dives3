import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, RefreshCw, Search } from "lucide-react";
import {
  fetchPlayerRegistrations,
  fetchPlayerRegistrationsForExport,
} from "@/lib/adminServer";
import { LEADS_PAGE_SIZE } from "@/lib/admin.server";
import type { PlayerRegistration } from "@/lib/admin.server";
import {
  downloadTextFile,
  exportRegistrationsFilename,
  registrationsToCsv,
  registrationsToJson,
} from "@/lib/exportRegistrations";

export default function LeadsSection() {
  const [rows, setRows] = useState<PlayerRegistration[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / LEADS_PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * LEADS_PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * LEADS_PAGE_SIZE, total);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const search = query.trim() || undefined;
      const result = await fetchPlayerRegistrations({
        data: { page, pageSize: LEADS_PAGE_SIZE, search },
      });
      setRows(result.rows);
      setTotal(result.total);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load leads");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (total > 0 && page > totalPages) {
      setPage(totalPages);
    }
  }, [total, page, totalPages]);

  const handleSearchChange = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  const handleExport = async (format: "csv" | "json") => {
    setExporting(true);
    setError(null);
    try {
      const exportRows = await fetchPlayerRegistrationsForExport({
        data: { search: query.trim() || undefined },
      });
      if (exportRows.length === 0) return;

      if (format === "csv") {
        downloadTextFile(
          registrationsToCsv(exportRows),
          exportRegistrationsFilename("csv"),
          "text/csv;charset=utf-8"
        );
        return;
      }
      downloadTextFile(
        registrationsToJson(exportRows),
        exportRegistrationsFilename("json"),
        "application/json;charset=utf-8"
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Leads</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Booth lead capture from the phone controller (PII). Export for CRM or event follow-up.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search name, email, company, session…"
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void handleExport("csv")}
            disabled={exporting || total === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
          <button
            type="button"
            onClick={() => void handleExport("json")}
            disabled={exporting || total === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            JSON
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-500">
        {loading
          ? "Loading…"
          : total === 0
            ? query.trim()
              ? "No leads match your search."
              : "No leads yet."
            : query.trim()
              ? `${total} matching lead(s) · showing ${rangeStart}–${rangeEnd}`
              : `${total} lead(s) · showing ${rangeStart}–${rangeEnd}`}
      </p>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[760px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="px-4 py-3 text-xs font-medium text-gray-500">First name</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">Last name</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">Company</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">Email</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">Registered</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">Session</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">GDPR</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">
                    Loading leads…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">
                    {total === 0 && query.trim()
                      ? "No leads match your search."
                      : "No leads on this page."}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-gray-700">{r.first_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{r.last_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{r.company || "—"}</td>
                    <td className="px-4 py-3 text-sm text-indigo-600">{r.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono font-semibold text-gray-900">
                      {r.session_code}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
                          r.gdpr_consent
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-gray-200 bg-gray-50 text-gray-500"
                        }`}
                      >
                        {r.gdpr_consent ? "Yes" : "No"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && total > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-gray-100 px-4 py-3 bg-gray-50/40">
            <p className="text-xs text-gray-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
