"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Briefcase,
  Building2,
  Palette,
  Megaphone,
  Target,
  Wand2,
  Zap,
  Shield,
  Hand,
  DollarSign,
  Rocket,
  Search,
  ImageIcon,
  Calendar,
  Video,
  Check,
  ArrowRight,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

type OnboardingData = {
  name: string;
  role: string;
  expectations: string[];
  autonomy: string;
  monthlyBudget: number;
  firstPriority: string;
};

const STEPS = ["Welcome", "Role", "Expectations", "Autonomy", "Budget", "Priority", "Complete"];

const ROLES = [
  { id: "creative_director", label: "Creative Director", description: "I lead the creative vision", icon: Palette },
  { id: "marketing_manager", label: "Marketing Manager", description: "I manage campaigns & channels", icon: Megaphone },
  { id: "brand_owner", label: "Brand Owner", description: "It's my brand, I do it all", icon: Building2 },
  { id: "agency", label: "Agency", description: "I manage multiple client brands", icon: Briefcase },
  { id: "freelancer", label: "Freelancer", description: "I create for multiple clients", icon: User },
];

const EXPECTATIONS = [
  { id: "ad_creatives", label: "Generate ad creatives", icon: ImageIcon },
  { id: "video_production", label: "Video production", icon: Video },
  { id: "competitor_research", label: "Research competitors", icon: Search },
  { id: "content_calendar", label: "Manage content calendar", icon: Calendar },
  { id: "campaign_automation", label: "Full campaign automation", icon: Zap },
  { id: "brand_identity", label: "Build brand identity", icon: Palette },
];

const AUTONOMY_LEVELS = [
  {
    id: "full",
    label: "Full Autonomy",
    description: "AI generates, schedules, and publishes. You review when needed.",
    icon: Zap,
  },
  {
    id: "semi",
    label: "Semi-Autonomous",
    description: "AI generates and proposes. You approve before publishing.",
    icon: Shield,
  },
  {
    id: "manual",
    label: "Manual Control",
    description: "You control every step. AI assists when asked.",
    icon: Hand,
  },
];

const PRIORITIES = [
  { id: "launch_campaign", label: "Launch a new campaign", icon: Rocket },
  { id: "create_assets", label: "Create social media assets", icon: ImageIcon },
  { id: "analyze_competitors", label: "Analyze competitor ads", icon: Search },
  { id: "build_brand", label: "Build brand identity", icon: Palette },
];

const BUDGET_RANGES = [500, 1000, 2500, 5000, 10000];

export default function DirectorOnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    name: "",
    role: "",
    expectations: [],
    autonomy: "semi",
    monthlyBudget: 2500,
    firstPriority: "",
  });

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  function next() {
    if (currentStep < STEPS.length - 1) setCurrentStep(currentStep + 1);
  }

  function back() {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  }

  function toggleExpectation(id: string) {
    setData((d) => ({
      ...d,
      expectations: d.expectations.includes(id)
        ? d.expectations.filter((e) => e !== id)
        : [...d.expectations, id],
    }));
  }

  async function handleComplete() {
    try {
      await fetch("/api/users/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboarding: data }),
      });
    } catch {}
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-[#F3F0EB]">
        <motion.div
          className="h-full bg-[#161514]"
          animate={{ width: `${progress}%` }}
          transition={spring.smooth}
        />
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={spring.smooth}
            >
              {/* Step 0: Welcome */}
              {currentStep === 0 && (
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ ...spring.smooth, delay: 0.1 }}
                    className="flex items-center justify-center h-20 w-20 rounded-2xl bg-[#161514] mx-auto mb-8"
                  >
                    <Sparkles className="h-10 w-10 text-white" />
                  </motion.div>
                  <h1 className="text-headline text-[#161514] mb-3">Welcome to TwinLink</h1>
                  <p className="text-[15px] text-[#737373] mb-8 leading-relaxed">
                    Let&apos;s set up your AI creative director. This takes about a minute.
                  </p>
                  <input
                    value={data.name}
                    onChange={(e) => setData({ ...data, name: e.target.value })}
                    placeholder="What should we call you?"
                    className="w-full h-14 bg-white border border-[rgba(22,21,20,0.10)] rounded-xl px-5 text-[16px] text-[#161514] placeholder:text-[#a3a3a3] outline-none focus:border-[#161514] text-center"
                    autoFocus
                  />
                  <button
                    onClick={next}
                    disabled={!data.name.trim()}
                    className={cn(
                      "mt-6 flex items-center justify-center gap-2 w-full py-4 rounded-xl text-[14px] font-semibold transition-all",
                      data.name.trim()
                        ? "bg-[#161514] text-white hover:bg-[#2a2928]"
                        : "bg-[#F3F0EB] text-[#a3a3a3] cursor-not-allowed"
                    )}
                  >
                    Continue <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Step 1: Role */}
              {currentStep === 1 && (
                <div>
                  <h2 className="text-headline-sm text-[#161514] mb-2">What describes you best?</h2>
                  <p className="text-[14px] text-[#737373] mb-8">This helps us tailor the experience.</p>
                  <div className="space-y-2">
                    {ROLES.map((role) => {
                      const Icon = role.icon;
                      const isSelected = data.role === role.id;
                      return (
                        <motion.button
                          key={role.id}
                          onClick={() => setData({ ...data, role: role.id })}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          transition={spring.snappy}
                          className={cn(
                            "w-full flex items-center gap-4 px-5 py-4 rounded-xl border text-left transition-all",
                            isSelected
                              ? "border-[#161514] bg-[#161514] text-white"
                              : "border-[rgba(22,21,20,0.08)] bg-white text-[#161514] hover:border-[rgba(22,21,20,0.20)]"
                          )}
                        >
                          <Icon className="h-5 w-5 shrink-0" />
                          <div>
                            <p className="text-[14px] font-medium">{role.label}</p>
                            <p className={cn("text-[12px]", isSelected ? "text-white/60" : "text-[#a3a3a3]")}>
                              {role.description}
                            </p>
                          </div>
                          {isSelected && <Check className="h-5 w-5 ml-auto shrink-0" />}
                        </motion.button>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between mt-8">
                    <button onClick={back} className="text-[13px] text-[#a3a3a3] hover:text-[#161514]">
                      <ArrowLeft className="h-4 w-4 inline mr-1" /> Back
                    </button>
                    <button
                      onClick={next}
                      disabled={!data.role}
                      className={cn(
                        "flex items-center gap-2 px-6 py-3 rounded-xl text-[13px] font-medium",
                        data.role ? "bg-[#161514] text-white" : "bg-[#F3F0EB] text-[#a3a3a3] cursor-not-allowed"
                      )}
                    >
                      Continue <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Expectations */}
              {currentStep === 2 && (
                <div>
                  <h2 className="text-headline-sm text-[#161514] mb-2">What do you want TwinLink to do?</h2>
                  <p className="text-[14px] text-[#737373] mb-8">Select all that apply.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {EXPECTATIONS.map((exp) => {
                      const Icon = exp.icon;
                      const isSelected = data.expectations.includes(exp.id);
                      return (
                        <motion.button
                          key={exp.id}
                          onClick={() => toggleExpectation(exp.id)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          transition={spring.snappy}
                          className={cn(
                            "flex flex-col items-center gap-2 px-4 py-5 rounded-xl border text-center transition-all",
                            isSelected
                              ? "border-[#161514] bg-[#161514] text-white"
                              : "border-[rgba(22,21,20,0.08)] bg-white text-[#161514] hover:border-[rgba(22,21,20,0.20)]"
                          )}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="text-[12px] font-medium">{exp.label}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between mt-8">
                    <button onClick={back} className="text-[13px] text-[#a3a3a3] hover:text-[#161514]">
                      <ArrowLeft className="h-4 w-4 inline mr-1" /> Back
                    </button>
                    <button
                      onClick={next}
                      disabled={data.expectations.length === 0}
                      className={cn(
                        "flex items-center gap-2 px-6 py-3 rounded-xl text-[13px] font-medium",
                        data.expectations.length > 0 ? "bg-[#161514] text-white" : "bg-[#F3F0EB] text-[#a3a3a3] cursor-not-allowed"
                      )}
                    >
                      Continue <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Autonomy */}
              {currentStep === 3 && (
                <div>
                  <h2 className="text-headline-sm text-[#161514] mb-2">How much freedom should your AI have?</h2>
                  <p className="text-[14px] text-[#737373] mb-8">You can always change this later.</p>
                  <div className="space-y-3">
                    {AUTONOMY_LEVELS.map((level) => {
                      const Icon = level.icon;
                      const isSelected = data.autonomy === level.id;
                      return (
                        <motion.button
                          key={level.id}
                          onClick={() => setData({ ...data, autonomy: level.id })}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          transition={spring.snappy}
                          className={cn(
                            "w-full flex items-center gap-4 px-5 py-5 rounded-xl border text-left transition-all",
                            isSelected
                              ? "border-[#161514] bg-[#161514] text-white"
                              : "border-[rgba(22,21,20,0.08)] bg-white text-[#161514] hover:border-[rgba(22,21,20,0.20)]"
                          )}
                        >
                          <div className={cn(
                            "flex items-center justify-center h-12 w-12 rounded-xl shrink-0",
                            isSelected ? "bg-white/10" : "bg-[#F3F0EB]"
                          )}>
                            <Icon className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-[15px] font-medium">{level.label}</p>
                            <p className={cn("text-[12px] mt-0.5", isSelected ? "text-white/60" : "text-[#a3a3a3]")}>
                              {level.description}
                            </p>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between mt-8">
                    <button onClick={back} className="text-[13px] text-[#a3a3a3] hover:text-[#161514]">
                      <ArrowLeft className="h-4 w-4 inline mr-1" /> Back
                    </button>
                    <button onClick={next} className="flex items-center gap-2 px-6 py-3 bg-[#161514] text-white rounded-xl text-[13px] font-medium">
                      Continue <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Budget */}
              {currentStep === 4 && (
                <div>
                  <h2 className="text-headline-sm text-[#161514] mb-2">Monthly creative budget?</h2>
                  <p className="text-[14px] text-[#737373] mb-8">Helps your AI director plan efficiently.</p>

                  <div className="text-center mb-8">
                    <span className="text-display text-[#161514]">${data.monthlyBudget.toLocaleString()}</span>
                    <p className="text-[12px] text-[#a3a3a3] mt-1">per month</p>
                  </div>

                  <div className="flex justify-center gap-2 mb-8">
                    {BUDGET_RANGES.map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setData({ ...data, monthlyBudget: amount })}
                        className={cn(
                          "px-4 py-2 rounded-lg text-[12px] mono border transition-all",
                          data.monthlyBudget === amount
                            ? "border-[#161514] bg-[#161514] text-white"
                            : "border-[rgba(22,21,20,0.10)] text-[#737373] hover:border-[#161514]/30"
                        )}
                      >
                        ${amount >= 1000 ? `${amount / 1000}k` : amount}
                      </button>
                    ))}
                  </div>

                  {/* Cost breakdown estimate */}
                  <div className="bg-white border border-[rgba(22,21,20,0.06)] rounded-xl p-4 space-y-2">
                    <p className="label-caps text-[10px] mb-2">Estimated monthly output</p>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-[#737373]">Video ads</span>
                      <span className="mono text-[#161514]">~{Math.floor(data.monthlyBudget / 50)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-[#737373]">Static ads</span>
                      <span className="mono text-[#161514]">~{Math.floor(data.monthlyBudget / 5)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-[#737373]">Competitor reports</span>
                      <span className="mono text-[#161514]">~{Math.floor(data.monthlyBudget / 20)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-8">
                    <button onClick={back} className="text-[13px] text-[#a3a3a3] hover:text-[#161514]">
                      <ArrowLeft className="h-4 w-4 inline mr-1" /> Back
                    </button>
                    <button onClick={next} className="flex items-center gap-2 px-6 py-3 bg-[#161514] text-white rounded-xl text-[13px] font-medium">
                      Continue <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 5: First Priority */}
              {currentStep === 5 && (
                <div>
                  <h2 className="text-headline-sm text-[#161514] mb-2">What&apos;s your first priority?</h2>
                  <p className="text-[14px] text-[#737373] mb-8">We&apos;ll take you there right after setup.</p>
                  <div className="space-y-2">
                    {PRIORITIES.map((p) => {
                      const Icon = p.icon;
                      const isSelected = data.firstPriority === p.id;
                      return (
                        <motion.button
                          key={p.id}
                          onClick={() => setData({ ...data, firstPriority: p.id })}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          transition={spring.snappy}
                          className={cn(
                            "w-full flex items-center gap-4 px-5 py-4 rounded-xl border text-left transition-all",
                            isSelected
                              ? "border-[#161514] bg-[#161514] text-white"
                              : "border-[rgba(22,21,20,0.08)] bg-white text-[#161514] hover:border-[rgba(22,21,20,0.20)]"
                          )}
                        >
                          <Icon className="h-5 w-5 shrink-0" />
                          <span className="text-[14px] font-medium">{p.label}</span>
                          {isSelected && <Check className="h-5 w-5 ml-auto shrink-0" />}
                        </motion.button>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between mt-8">
                    <button onClick={back} className="text-[13px] text-[#a3a3a3] hover:text-[#161514]">
                      <ArrowLeft className="h-4 w-4 inline mr-1" /> Back
                    </button>
                    <button
                      onClick={next}
                      disabled={!data.firstPriority}
                      className={cn(
                        "flex items-center gap-2 px-6 py-3 rounded-xl text-[13px] font-medium",
                        data.firstPriority ? "bg-[#161514] text-white" : "bg-[#F3F0EB] text-[#a3a3a3] cursor-not-allowed"
                      )}
                    >
                      Finish <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 6: Complete */}
              {currentStep === 6 && (
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ ...spring.smooth, delay: 0.1 }}
                    className="flex items-center justify-center h-20 w-20 rounded-full bg-[#4D5D4B] mx-auto mb-8"
                  >
                    <Check className="h-10 w-10 text-white" />
                  </motion.div>
                  <motion.h1
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...spring.smooth, delay: 0.2 }}
                    className="text-headline text-[#161514] mb-3"
                  >
                    You&apos;re all set, {data.name}!
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...spring.smooth, delay: 0.3 }}
                    className="text-[15px] text-[#737373] mb-10 leading-relaxed"
                  >
                    Your AI creative director is configured and ready. Let&apos;s create something amazing.
                  </motion.p>
                  <motion.button
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...spring.smooth, delay: 0.4 }}
                    onClick={handleComplete}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center gap-3 px-8 py-4 bg-[#161514] text-white rounded-xl text-[15px] font-semibold hover:bg-[#2a2928] transition-colors"
                  >
                    <Sparkles className="h-5 w-5" />
                    Start Creating
                  </motion.button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Step counter */}
      <div className="flex items-center justify-center gap-1.5 py-6">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === currentStep ? "w-8 bg-[#161514]" : i < currentStep ? "w-1.5 bg-[#4D5D4B]" : "w-1.5 bg-[#d4d4d4]"
            )}
          />
        ))}
      </div>
    </div>
  );
}
