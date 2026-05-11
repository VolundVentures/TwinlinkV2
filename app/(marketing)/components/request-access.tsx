"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle2, X } from "lucide-react";

type Ctx = {
  open: () => void;
  close: () => void;
  isOpen: boolean;
};

const RequestAccessCtx = createContext<Ctx | null>(null);

export function useRequestAccess(): Ctx {
  const ctx = useContext(RequestAccessCtx);
  if (!ctx) throw new Error("useRequestAccess must be used inside RequestAccessProvider");
  return ctx;
}

export function RequestAccessProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  return (
    <RequestAccessCtx.Provider value={{ open, close, isOpen }}>
      {children}
      <RequestAccessDialog isOpen={isOpen} close={close} />
    </RequestAccessCtx.Provider>
  );
}

// Button wrapper that opens the dialog. Renders children as-is (styled by caller).
export function RequestAccessTrigger({
  children,
  className,
  onClick,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
}) {
  const { open } = useRequestAccess();
  return (
    <button
      type="button"
      className={className}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) open();
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

type Status = "idle" | "submitting" | "success" | "error";

function RequestAccessDialog({
  isOpen,
  close,
}: {
  isOpen: boolean;
  close: () => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    role: "",
    useCase: "",
  });

  useEffect(() => {
    if (!isOpen) {
      // Reset on close, slightly delayed so the exit animation stays clean.
      const t = setTimeout(() => {
        setStatus("idle");
        setError(null);
        setForm({ name: "", email: "", company: "", role: "", useCase: "" });
      }, 400);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Something went wrong.");
        setStatus("error");
        return;
      }
      setStatus("success");
    } catch {
      setError("Network error. Try again.");
      setStatus("error");
    }
  }

  const EASE = [0.22, 1, 0.36, 1] as const;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-stretch justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Backdrop */}
          <motion.div
            onClick={close}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />

          {/* Panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Request access"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.6, ease: EASE }}
            className="relative ml-auto flex h-full w-full max-w-xl flex-col bg-white text-neutral-900 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-200 px-8 py-6">
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-[22px] tracking-tight text-neutral-900">
                  TwinLink
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-400">
                  director
                </span>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="flex h-10 w-10 items-center justify-center text-neutral-500 transition-colors hover:text-neutral-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative flex-1 overflow-y-auto">
              <AnimatePresence mode="wait">
                {status === "success" ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.5, ease: EASE }}
                    className="flex h-full flex-col items-start justify-center px-8 py-16"
                  >
                    <motion.div
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                      className="mb-8"
                    >
                      <CheckCircle2 className="h-12 w-12 text-neutral-900" strokeWidth={1} />
                    </motion.div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-neutral-500">
                      Received
                    </p>
                    <h2 className="mt-4 font-serif text-[44px] leading-[1.05] tracking-tight text-neutral-900">
                      You&apos;re on the list.
                    </h2>
                    <p className="mt-6 max-w-sm font-serif text-[16px] leading-[1.7] text-neutral-600">
                      We review each request personally. Expect to hear from us within 72 hours
                      with an invite link and a short briefing call.
                    </p>
                    <button
                      type="button"
                      onClick={close}
                      className="mt-12 inline-flex h-12 items-center gap-3 bg-neutral-900 px-6 font-mono text-[11px] uppercase tracking-[0.22em] text-white transition-colors hover:bg-neutral-800"
                    >
                      Back to the reel
                    </button>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    onSubmit={onSubmit}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.4, ease: EASE }}
                    className="flex flex-col gap-8 px-8 py-10"
                  >
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-neutral-500">
                        [ Request access ]
                      </p>
                      <h2 className="mt-4 font-serif text-[40px] leading-[1.05] tracking-tight text-neutral-900">
                        Direct your first <span className="italic text-neutral-400">film.</span>
                      </h2>
                      <p className="mt-4 max-w-sm font-serif text-[15px] leading-[1.7] text-neutral-600">
                        TwinLink is invite-only for now. Tell us a little about what you&apos;d make
                        and we&apos;ll reach out.
                      </p>
                    </div>

                    <div className="flex flex-col gap-6">
                      <Field
                        label="Name"
                        required
                        value={form.name}
                        onChange={(v) => setForm({ ...form, name: v })}
                        disabled={status === "submitting"}
                      />
                      <Field
                        label="Email"
                        type="email"
                        required
                        value={form.email}
                        onChange={(v) => setForm({ ...form, email: v })}
                        disabled={status === "submitting"}
                      />
                      <Field
                        label="Company / Studio"
                        value={form.company}
                        onChange={(v) => setForm({ ...form, company: v })}
                        disabled={status === "submitting"}
                      />
                      <Field
                        label="Your role"
                        value={form.role}
                        onChange={(v) => setForm({ ...form, role: v })}
                        disabled={status === "submitting"}
                        placeholder="Creative Director, Brand Owner, Filmmaker…"
                      />
                      <Field
                        label="What would you make first?"
                        value={form.useCase}
                        onChange={(v) => setForm({ ...form, useCase: v })}
                        disabled={status === "submitting"}
                        multiline
                      />
                    </div>

                    {error && (
                      <motion.p
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="font-mono text-[11px] uppercase tracking-[0.18em] text-red-600"
                      >
                        {error}
                      </motion.p>
                    )}

                    <div className="flex flex-col gap-4 pt-2">
                      <button
                        type="submit"
                        disabled={status === "submitting"}
                        className="group inline-flex h-14 items-center justify-center gap-3 bg-neutral-900 px-6 font-mono text-[11px] uppercase tracking-[0.22em] text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {status === "submitting" ? (
                          <>
                            <Spinner />
                            Sending
                          </>
                        ) : (
                          <>
                            Request access
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                          </>
                        )}
                      </button>
                      <p className="text-center font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-400">
                        No spam · No credit card · Manual review
                      </p>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  disabled,
  multiline,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  multiline?: boolean;
  placeholder?: string;
}) {
  const base =
    "w-full bg-transparent border-b border-neutral-300 px-0 py-3 font-serif text-[18px] text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-neutral-900 transition-colors disabled:opacity-60";
  return (
    <label className="block">
      <span className="block font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-500">
        {label}
        {required && <span className="ml-1 text-neutral-400">*</span>}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          rows={3}
          className={`${base} resize-none`}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          className={base}
        />
      )}
    </label>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
    />
  );
}
