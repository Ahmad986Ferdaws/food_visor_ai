"use client";
import { useState, useEffect } from "react";

interface Step {
  name: string;
  status: "pending" | "ok" | "fail";
  detail: string;
}

export default function TestLoginPage() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);

  const push = (s: Step) => setSteps((prev) => [...prev, s]);
  const replace = (name: string, status: Step["status"], detail: string) =>
    setSteps((prev) => prev.map((s) => (s.name === name ? { ...s, status, detail } : s)));

  useEffect(() => {
    if (running) return;
    setRunning(true);
    (async () => {
      // Step 1: localStorage available?
      try {
        localStorage.setItem("__probe", "1");
        localStorage.removeItem("__probe");
        push({ name: "localStorage", status: "ok", detail: "writable" });
      } catch (e: any) {
        push({ name: "localStorage", status: "fail", detail: `${e?.message ?? e}` });
        return;
      }

      // Step 2: hit backend login
      push({ name: "login API", status: "pending", detail: "POST /v1/auth/login..." });
      let token = "";
      let user: any = null;
      try {
        const res = await fetch("http://localhost:8000/v1/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "you@example.com", password: "test1234" }),
        });
        const text = await res.text();
        if (!res.ok) {
          replace("login API", "fail", `HTTP ${res.status} — body: ${text.slice(0, 300)}`);
          return;
        }
        const data = JSON.parse(text);
        token = data.token;
        user = data.user;
        replace(
          "login API",
          "ok",
          `HTTP ${res.status} — token len ${token?.length}, user.email: ${user?.email}`,
        );
      } catch (e: any) {
        replace("login API", "fail", `network/CORS error: ${e?.message ?? e}`);
        return;
      }

      // Step 3: write to localStorage
      try {
        localStorage.setItem("auth_token", token);
        const readBack = localStorage.getItem("auth_token");
        if (readBack === token) {
          push({ name: "auth_token persist", status: "ok", detail: `read back len ${readBack.length}` });
        } else {
          push({ name: "auth_token persist", status: "fail", detail: "round-trip mismatch" });
          return;
        }
      } catch (e: any) {
        push({ name: "auth_token persist", status: "fail", detail: `${e?.message ?? e}` });
        return;
      }

      // Step 4: hit a protected endpoint with the token
      push({ name: "auth/me", status: "pending", detail: "GET /v1/auth/me..." });
      try {
        const res = await fetch("http://localhost:8000/v1/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const text = await res.text();
        if (!res.ok) {
          replace("auth/me", "fail", `HTTP ${res.status} — body: ${text.slice(0, 200)}`);
          return;
        }
        replace("auth/me", "ok", `HTTP ${res.status} — body: ${text.slice(0, 200)}`);
      } catch (e: any) {
        replace("auth/me", "fail", `${e?.message ?? e}`);
      }

      push({ name: "next step", status: "ok", detail: "Click below to navigate to /app/dashboard" });
    })();
  }, [running]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F1F8E9] via-white to-[#E8F5E9] p-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Login diagnostic</h1>
        <p className="mb-6 text-sm text-slate-500">
          Tests every step of the auth chain. Stops at the first failure.
        </p>

        <div className="space-y-2">
          {steps.map((s, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/60 bg-white/80 p-4 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span
                  className={
                    s.status === "ok"
                      ? "text-green-600"
                      : s.status === "fail"
                      ? "text-red-600"
                      : "text-amber-600"
                  }
                >
                  {s.status === "ok" ? "✅" : s.status === "fail" ? "❌" : "⏳"}
                </span>
                <span className="font-mono text-sm font-semibold text-slate-800">{s.name}</span>
              </div>
              <pre className="mt-2 break-all whitespace-pre-wrap text-xs text-slate-600">
                {s.detail}
              </pre>
            </div>
          ))}
        </div>

        {steps.some((s) => s.name === "auth/me" && s.status === "ok") && (
          <button
            onClick={() => (window.location.href = "/app/dashboard")}
            className="mt-6 w-full rounded-xl bg-[#4CAF50] py-3 font-semibold text-white shadow-sm hover:bg-[#43A047]"
          >
            Go to dashboard →
          </button>
        )}
      </div>
    </div>
  );
}
