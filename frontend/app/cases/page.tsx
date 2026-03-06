"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AuthRequired } from "@/components/ui/auth-required";
import { listCases } from "@/lib/api/cases";
import { ApiError } from "@/lib/api/client";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { CaseListResponse } from "@/lib/types/api";

export default function CasesPage() {
  const hydrated = useHydrated();
  const token = useAuthStore((state) => state.accessToken);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cases, setCases] = useState<CaseListResponse | null>(null);

  useEffect(() => {
    async function load() {
      if (!token) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await listCases(token, 1, 20);
        setCases(response);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load cases");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [token]);

  return (
    <main className="page">
      <section className="card stack">
        <h1>Cases (Module 4)</h1>
        <p className="muted">Case lifecycle dashboard for visible cases.</p>
      </section>

      {!hydrated ? null : token ? (
        <>
          {loading ? <p className="muted">Loading...</p> : null}
          {error ? <p className="error">{error}</p> : null}
          <section className="grid">
            {cases?.items.map((item) => (
              <article className="card stack" key={item.id}>
                <div className="row">
                  <h3 style={{ margin: 0 }}>{item.post.title}</h3>
                  <span className="badge">{item.status}</span>
                  <span className="badge">helpers: {item.helper_count}</span>
                </div>
                <p className="muted">
                  {item.post.city} · {item.post.category} · {item.post.urgency}
                </p>
                <Link href={`/cases/${item.id}`}>
                  <button className="ghost" type="button">
                    Open Case
                  </button>
                </Link>
              </article>
            ))}
            {!loading && cases && cases.items.length === 0 ? (
              <section className="card">
                <p className="muted">No cases visible to current user.</p>
              </section>
            ) : null}
          </section>
        </>
      ) : (
        <AuthRequired />
      )}
    </main>
  );
}
