"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { MessageSquare, GitBranch, Webhook, UserRound } from "lucide-react";

export type StepType = "message" | "condition" | "api_call" | "handoff";

export const STEP_TYPES: { type: StepType; label: string; accent: string }[] = [
  { type: "message", label: "Message", accent: "brass" },
  { type: "condition", label: "Condition", accent: "warning" },
  { type: "api_call", label: "API call", accent: "success" },
  { type: "handoff", label: "Handoff to human", accent: "danger" }
];

const ICONS: Record<StepType, typeof MessageSquare> = {
  message: MessageSquare,
  condition: GitBranch,
  api_call: Webhook,
  handoff: UserRound
};

const ACCENT_CLASSES: Record<string, { border: string; bg: string; text: string }> = {
  brass: { border: "border-brass", bg: "bg-brass/10", text: "text-brass" },
  warning: { border: "border-warning", bg: "bg-warning/10", text: "text-warning" },
  success: { border: "border-success", bg: "bg-success/10", text: "text-success" },
  danger: { border: "border-danger", bg: "bg-danger/10", text: "text-danger" }
};

export type StepNodeData = {
  stepType: StepType;
  label: string;
  content: string;
};

export default function WorkflowCanvasNode({
  data,
  selected
}: NodeProps & { data: StepNodeData }) {
  const meta = STEP_TYPES.find((s) => s.type === data.stepType) ?? STEP_TYPES[0];
  const Icon = ICONS[data.stepType];
  const accent = ACCENT_CLASSES[meta.accent];

  return (
    <div
      className={`rounded-md border-2 ${accent.border} ${accent.bg} px-3 py-2 min-w-[160px] max-w-[220px] ${
        selected ? "ring-2 ring-fg/30" : ""
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted" />
      <div className={`flex items-center gap-1.5 text-xs font-medium mb-1 ${accent.text}`}>
        <Icon size={12} /> {meta.label}
      </div>
      <p className="text-sm text-fg truncate">{data.label || "Untitled step"}</p>
      {data.content && <p className="text-xs text-muted truncate mt-0.5">{data.content}</p>}
      <Handle type="source" position={Position.Bottom} className="!bg-muted" />
    </div>
  );
}
