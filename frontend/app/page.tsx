import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page">
      <section className="card stack">
        <h1>HealAll Frontend Modules</h1>
        <p className="muted">
          Module 1-6 surfaces are live. Start with signup/login, then move to feed, cases,
          messaging, and moderation.
        </p>
        <div className="row">
          <Link href="/signup">
            <button>Signup</button>
          </Link>
          <Link href="/login">
            <button className="secondary">Login</button>
          </Link>
          <Link href="/feed">
            <button className="ghost">Open Feed</button>
          </Link>
        </div>
      </section>
    </main>
  );
}
