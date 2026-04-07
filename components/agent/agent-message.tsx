"use client";

import { cn } from "@/lib/utils";
import { Bot, User, AlertCircle } from "lucide-react";

type Props = {
  message: {
    role: "user" | "agent" | "system";
    content: string;
    timestamp: string;
  };
};

export function AgentMessage({ message }: Props) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser && "flex-row-reverse"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser && "bg-[#1A1A1A] text-white",
          message.role === "agent" && "bg-[#F3F4F6] text-[#1A1A1A]",
          isSystem && "bg-[#FEF2F2] text-[#EF4444]"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : isSystem ? (
          <AlertCircle className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>

      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5",
          isUser && "bg-[#F3F4F6] text-[15px] text-[#1A1A1A] leading-relaxed",
          message.role === "agent" && "border border-[#F0F0F0] bg-white text-[15px] text-[#1A1A1A] leading-relaxed",
          isSystem && "border border-[#FECACA] bg-[#FEF2F2] text-[14px] text-[#EF4444]"
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
