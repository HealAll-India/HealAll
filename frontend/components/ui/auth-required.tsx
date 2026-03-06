import Link from "next/link";

export function AuthRequired() {
  return (
    <section className="card stack">
      <h2>Authentication Required</h2>
      <p className="muted">This module needs an access token from Module 1 login.</p>
      <div className="row">
        <Link href="/login">
          <button>Go to Login</button>
        </Link>
        <Link href="/signup">
          <button className="ghost">Go to Signup</button>
        </Link>
      </div>
    </section>
  );
}
