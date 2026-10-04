"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import WorkflowCanvasNode, { STEP_TYPES, type StepType, type StepNodeData } from "@/app/_components/WorkflowCanvasNode";

const nodeTypes = { step: WorkflowCanvasNode };

let nextId = 1;
function freshId() {
  return `step-${Date.now()}-${nextId++}`;
}

function DesignerCanvas({ workflowId }: { workflowId: string }) {
  const router = useRouter();
  const [workflowName, setWorkflowName] = useState("");
  const [nodes, setNodes] = useState<Node<StepNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  useEffect(() => {
    fetch(`/api/v1/tenants/workflows/${workflowId}`)
      .then(async (res) => {
        if (res.status === 401) {
          router.replace("/login");
          return null;
        }
        if (!res.ok) {
          router.replace("/workflows");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setWorkflowName(data.workflow.name);
        const def = data.workflow.definition ?? { nodes: [], edges: [] };
        setNodes((def.nodes ?? []) as Node<StepNodeData>[]);
        setEdges((def.edges ?? []) as Edge[]);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId]);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<StepNodeData>>[]) =>
      setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );
  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    []
  );

  function addStep(stepType: StepType) {
    const id = freshId();
    const label = STEP_TYPES.find((s) => s.type === stepType)?.label ?? "Step";
    const newNode: Node<StepNodeData> = {
      id,
      type: "step",
      position: { x: 80 + ((nodes.length * 40) % 400), y: 60 + ((nodes.length * 60) % 300) },
      data: { stepType, label, content: "" }
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(id);
  }

  function updateSelectedNode(field: "label" | "content", value: string) {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) => (n.id === selectedNodeId ? { ...n, data: { ...n.data, [field]: value } } : n))
    );
  }

  function deleteSelectedNode() {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(null);
  }

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/v1/tenants/workflows/${workflowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ definition: { nodes, edges } })
    });
    setSaving(false);

    if (!res.ok) {
      showToast("Couldn't save — try again.");
      return;
    }
    showToast("Saved.");
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-ink text-fg">
        <p className="text-muted text-sm">Loading…</p>
      </main>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-ink text-fg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/workflows" className="text-muted hover:text-fg">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{workflowName}</p>
            <p className="text-xs text-muted">
              Designer — this graph isn&apos;t executed by anything yet, it&apos;s saved as a
              definition.
            </p>
          </div>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="bg-brass text-ink text-sm font-medium rounded-md px-4 py-2 disabled:opacity-60 flex-shrink-0"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-44 flex-shrink-0 bg-surface border-r border-border p-3">
          <p className="text-xs text-muted mb-2">Add a step</p>
          {STEP_TYPES.map((s) => (
            <button
              key={s.type}
              onClick={() => addStep(s.type)}
              className="w-full text-left text-xs px-2 py-2 rounded-md border border-border hover:border-brass mb-1.5"
            >
              + {s.label}
            </button>
          ))}
        </div>

        <div ref={wrapperRef} className="flex-1 min-w-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            colorMode="dark"
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>

        {selectedNode && (
          <div className="w-64 flex-shrink-0 bg-surface border-l border-border p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-muted">Edit step</p>
              <button onClick={deleteSelectedNode} className="text-muted hover:text-danger">
                <Trash2 size={14} />
              </button>
            </div>
            <label className="text-xs text-muted mb-1 block">Label</label>
            <input
              value={selectedNode.data.label}
              onChange={(e) => updateSelectedNode("label", e.target.value)}
              className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-sm mb-3"
            />
            <label className="text-xs text-muted mb-1 block">
              {selectedNode.data.stepType === "message"
                ? "Message text"
                : selectedNode.data.stepType === "condition"
                  ? "Condition"
                  : selectedNode.data.stepType === "api_call"
                    ? "Endpoint / description"
                    : "Note for staff"}
            </label>
            <textarea
              value={selectedNode.data.content}
              onChange={(e) => updateSelectedNode("content", e.target.value)}
              rows={4}
              className="w-full bg-surface2 border border-border rounded-md px-3 py-2 text-sm"
            />
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-surface2 border border-border rounded-md px-4 py-2.5 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default function WorkflowDesignerPage() {
  const params = useParams<{ workflowId: string }>();
  return (
    <ReactFlowProvider>
      <DesignerCanvas workflowId={params.workflowId} />
    </ReactFlowProvider>
  );
}
