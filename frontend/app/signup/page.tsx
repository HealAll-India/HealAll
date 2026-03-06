"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { signup } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { ageRanges } from "@/lib/constants";
import type { SignupRequest } from "@/lib/types/api";

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<SignupRequest>({
    name: "",
    phone: "",
    email: "",
    city: "",
    age_range: "25-34",
    invite_code: "",
    roles: ["help_seeker"]
  });

  function setRole(role: "helper" | "help_seeker", checked: boolean) {
    const roleSet = new Set(formData.roles);
    if (checked) {
      roleSet.add(role);
    } else {
      roleSet.delete(role);
    }

    const nextRoles = Array.from(roleSet);
    setFormData((prev) => ({ ...prev, roles: nextRoles as SignupRequest["roles"] }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (formData.roles.length === 0) {
      setError("Choose at least one role");
      return;
    }

    setLoading(true);
    try {
      const response = await signup(formData);
      setMessage(response.message);
      router.push(`/verify-otp?phone_or_email=${encodeURIComponent(formData.phone)}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="card stack">
        <h1>Signup (Module 1)</h1>
        <p className="muted">Invite-only onboarding with helper/help-seeker roles.</p>

        <form className="grid" onSubmit={handleSubmit}>
          <label>
            Full Name
            <input
              value={formData.name}
              onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </label>

          <div className="row">
            <label style={{ flex: 1 }}>
              Phone (+91XXXXXXXXXX)
              <input
                value={formData.phone}
                onChange={(event) => setFormData((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="+919999999999"
                required
              />
            </label>
            <label style={{ flex: 1 }}>
              Email
              <input
                type="email"
                value={formData.email}
                onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                required
              />
            </label>
          </div>

          <div className="row">
            <label style={{ flex: 1 }}>
              City
              <input
                value={formData.city}
                onChange={(event) => setFormData((prev) => ({ ...prev, city: event.target.value }))}
                required
              />
            </label>
            <label style={{ flex: 1 }}>
              Age Range
              <select
                value={formData.age_range}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, age_range: event.target.value as SignupRequest["age_range"] }))
                }
              >
                {ageRanges.map((range) => (
                  <option key={range} value={range}>
                    {range}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Invite Code
            <input
              value={formData.invite_code}
              onChange={(event) => setFormData((prev) => ({ ...prev, invite_code: event.target.value }))}
              required
            />
          </label>

          <div className="card stack" style={{ padding: "0.75rem" }}>
            <strong>Roles</strong>
            <label>
              <input
                type="checkbox"
                checked={formData.roles.includes("help_seeker")}
                onChange={(event) => setRole("help_seeker", event.target.checked)}
              />
              Help Seeker
            </label>
            <label>
              <input
                type="checkbox"
                checked={formData.roles.includes("helper")}
                onChange={(event) => setRole("helper", event.target.checked)}
              />
              Helper
            </label>
          </div>

          <button disabled={loading} type="submit">
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        {message ? <p className="success">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>
    </main>
  );
}
