// Single source of truth for agent capabilities and channels — imported by
// both the API routes (validation, system-prompt building) and the UI, so
// the two can't drift apart. Labels match the AgentForge prototype.

export const CAPABILITIES = [
  { key: "answer_questions", icon: "💬", label: "Answer questions" },
  { key: "recommend_products", icon: "🛍️", label: "Recommend products" },
  { key: "create_orders", icon: "🧾", label: "Create orders" },
  { key: "book_appointments", icon: "📅", label: "Book appointments" },
  { key: "create_tickets", icon: "🎫", label: "Create tickets" },
  { key: "human_handoff", icon: "👤", label: "Human handoff" }
] as const;

export const CHANNELS = [
  { key: "web_widget", icon: "🌐", label: "Website widget" },
  { key: "whatsapp", icon: "🟢", label: "WhatsApp" },
  { key: "instagram", icon: "📷", label: "Instagram" },
  { key: "email", icon: "✉️", label: "Email" },
  { key: "api", icon: "🔌", label: "API" },
  { key: "voice", icon: "☎️", label: "Voice" }
] as const;

export const TONES = [
  { value: "warm_casual", label: "Warm & casual" },
  { value: "formal", label: "Formal" },
  { value: "playful", label: "Playful" }
] as const;

export const CAPABILITY_KEYS = CAPABILITIES.map((c) => c.key) as [
  (typeof CAPABILITIES)[number]["key"],
  ...(typeof CAPABILITIES)[number]["key"][]
];

export const CHANNEL_KEYS = CHANNELS.map((c) => c.key) as [
  (typeof CHANNELS)[number]["key"],
  ...(typeof CHANNELS)[number]["key"][]
];
