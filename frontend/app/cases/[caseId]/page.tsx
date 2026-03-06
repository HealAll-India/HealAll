"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { AuthRequired } from "@/components/ui/auth-required";
import { addCaseNote, closeCase, getCase, listCaseNotes, offerHelp, reopenCase } from "@/lib/api/cases";
import { ApiError } from "@/lib/api/client";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { CaseNoteResponse, CaseResponse } from "@/lib/types/api";

export default function CaseDetailPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params.caseId;
  const hydrated = useHydrated();
  const token = useAuthStore((state) => state.accessToken);

  const [caseDetail, setCaseDetail] = useState<CaseResponse | null>(null);
  const [notes, setNotes] = useState<CaseNoteResponse[]>([]);
  const [noteBody, setNoteBody] = useState("");
  const [closureRemarks, setClosureRemarks] = useState("resolved with volunteer support");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadData() {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [detail, caseNotes] = await Promise.all([getCase(token, caseId), listCaseNotes(token, caseId)]);
      setCaseDetail(detail);
      setNotes(caseNotes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load case");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      void loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, caseId]);

  async function handleOfferHelp() {
    if (!token) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      await offerHelp(token, caseId);
      setMessage("Help offer submitted.");
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to offer help");
    }
  }

  async function handleAddNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !noteBody.trim()) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      const note = await addCaseNote(token, caseId, { body: noteBody.trim() });
      setNotes((prev) => [...prev, note]);
      setNoteBody("");
      setMessage("Case note added.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add note");
    }
  }

  async function handleCloseCase() {
    if (!token) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      await closeCase(token, caseId, {
        closure_remarks: closureRemarks,
        resolution_type: "resolved",
        impact_consent: false
      });
      setMessage("Closure action submitted.");
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to close case");
    }
  }

  async function handleReopenCase() {
    if (!token) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      const reopened = await reopenCase(token, caseId);
      setCaseDetail(reopened);
      setMessage("Case reopened.");
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reopen case");
    }
  }

  return (
    <main className="page">
      {!hydrated ? null : token ? (
        <>
          <section className="card stack">
            <h1>Case Detail (Module 4)</h1>
            {loading ? <p className="muted">Loading...</p> : null}
            {caseDetail ? (
              <>
                <div className="row">
                  <h2 style={{ margin: 0 }}>{caseDetail.post.title}</h2>
                  <span className="badge">{caseDetail.status}</span>
                  <span className="badge">helpers: {caseDetail.helper_count}</span>
                </div>
                <p className="muted">
                  {caseDetail.post.city} · {caseDetail.post.category} · {caseDetail.post.urgency}
                </p>
                <div className="row">
                  <button onClick={handleOfferHelp} type="button">
                    Offer Help
                  </button>
                  <button className="secondary" onClick={handleReopenCase} type="button">
                    Reopen Case
                  </button>
                </div>
              </>
            ) : null}
          </section>

          <section className="card stack">
            <h3>Case Notes</h3>
            <form className="grid" onSubmit={handleAddNote}>
              <textarea
                value={noteBody}
                onChange={(event) => setNoteBody(event.target.value)}
                placeholder="Add a private case note"
              />
              <button type="submit">Add Note</button>
            </form>
            <div className="stack">
              {notes.map((note) => (
                <article className="card" key={note.id}>
                  <p style={{ marginTop: 0 }}>{note.body}</p>
                  <p className="muted">
                    {note.author.name} · {note.created_at}
                  </p>
                </article>
              ))}
              {notes.length === 0 ? <p className="muted">No notes yet.</p> : null}
            </div>
          </section>

          <section className="card stack">
            <h3>Closure</h3>
            <label>
              Closure remarks
              <textarea
                value={closureRemarks}
                onChange={(event) => setClosureRemarks(event.target.value)}
              />
            </label>
            <button onClick={handleCloseCase} type="button">
              Request / Confirm Closure
            </button>
          </section>

          {message ? <p className="success">{message}</p> : null}
          {error ? <p className="error">{error}</p> : null}
        </>
      ) : (
        <AuthRequired />
      )}
    </main>
  );
}
