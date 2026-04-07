"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n/use-translations";
import { cn } from "@/lib/utils";
import {
  ImageIcon,
  Layers,
  VideoIcon,
  SearchIcon,
  PlayCircle,
  ArrowRight,
  Globe,
} from "lucide-react";
import type { Brand } from "@/lib/database.types";

const taskTypes = [
  { id: "static_ad", labelKey: "staticAd" as const, descKey: "staticAdDesc" as const, icon: ImageIcon, popular: true, credits: 5 },
  { id: "campaign", labelKey: "campaign" as const, descKey: "campaignDesc" as const, icon: Layers, popular: true, credits: 50 },
  { id: "ugc_video", labelKey: "ugcVideo" as const, descKey: "ugcVideoDesc" as const, icon: VideoIcon, popular: false, credits: 25 },
  { id: "competitor_research", labelKey: "research" as const, descKey: "researchDesc" as const, icon: SearchIcon, popular: false, credits: 3 },
  { id: "video_template", labelKey: "videoTemplates" as const, descKey: "videoTemplatesDesc" as const, icon: PlayCircle, popular: false, credits: 20 },
];

type Step = "task" | "configure" | "running";

export default function NewTaskPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [step, setStep] = useState<Step>("task");
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [language, setLanguage] = useState("en");

  useEffect(() => {
    fetch("/api/brands")
      .then((r) => r.json())
      .then((data) => {
        setBrands(data.brands || []);
        const defaultBrand = (data.brands || []).find((b: Brand) => b.is_default);
        if (defaultBrand) setSelectedBrand(defaultBrand.id);
        else if (data.brands?.length) setSelectedBrand(data.brands[0].id);
      })
      .catch(console.error);
  }, []);

  function handleTaskSelect(taskId: string) {
    setSelectedTask(taskId);
    setStep("configure");
  }

  function handleLaunch() {
    if (!selectedTask || !selectedBrand) return;
    const params = new URLSearchParams({
      type: selectedTask,
      brandId: selectedBrand,
      language,
      ...(prompt && { prompt }),
    });
    router.push(`/dashboard/generate?${params}`);
  }

  const selectedTaskInfo = taskTypes.find((t) => t.id === selectedTask);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Step 1: Pick task */}
      {step === "task" && (
        <>
          <div className="text-center">
            <h1 className="text-2xl font-bold">{t.tasks.pickTask}</h1>
            <p className="mt-2 text-muted-foreground">{t.tasks.pickTaskSub}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {taskTypes.map((task) => {
              const Icon = task.icon;
              return (
                <Card
                  key={task.id}
                  className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
                  onClick={() => handleTaskSelect(task.id)}
                >
                  <CardContent className="flex items-start gap-3 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {t.tasks[task.labelKey]}
                        </span>
                        {task.popular && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            POPULAR
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t.tasks[task.descKey]}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {task.credits} {t.credits.credits}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Step 2: Configure */}
      {step === "configure" && selectedTaskInfo && (
        <>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setStep("task")}>
              {t.common.back}
            </Button>
            <h1 className="text-xl font-bold">{t.tasks[selectedTaskInfo.labelKey]}</h1>
          </div>

          <div className="space-y-6">
            {/* Brand selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Select Brand
              </Label>
              {brands.length > 0 ? (
                <Select value={selectedBrand} onValueChange={(v) => v && setSelectedBrand(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a brand" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        <div className="flex items-center gap-2">
                          {brand.primary_color && (
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: brand.primary_color }}
                            />
                          )}
                          {brand.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-center">
                  <p className="text-sm text-muted-foreground">No brands yet</p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => router.push("/onboarding")}
                  >
                    Add your first brand
                  </Button>
                </div>
              )}
            </div>

            {/* Language */}
            <div className="space-y-2">
              <Label>Ad Language</Label>
              <Select value={language} onValueChange={(v) => v && setLanguage(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">العربية (Arabic)</SelectItem>
                  <SelectItem value="fr">Français (French)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Prompt */}
            <div className="space-y-2">
              <Label>Brief (optional)</Label>
              <Textarea
                placeholder={
                  selectedTask === "static_ad"
                    ? "e.g. Create ads highlighting our new product launch, use bold colors and aspirational messaging..."
                    : selectedTask === "competitor_research"
                    ? "e.g. Analyze competitor ads in the venture building space in Morocco..."
                    : "Describe what you want to generate..."
                }
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
              />
            </div>

            <Button
              size="lg"
              className="w-full gap-2"
              onClick={handleLaunch}
              disabled={!selectedBrand}
            >
              Start Generating
              <ArrowRight className="h-4 w-4" />
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              This will use {selectedTaskInfo.credits} credits
            </p>
          </div>
        </>
      )}
    </div>
  );
}
