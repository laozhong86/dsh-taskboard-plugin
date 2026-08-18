// dsh-taskboard-plugin — Client 半边（R3：conversation.view 主区视图；R4：sidebar.footer.action 侧栏快捷入口）。
// 画面：dsh-client-ui-conversation 的 conversation.view 插槽（kind: list, scope: session；trajectory 同款接入）
// 注册铺满主区（conversation 列）的看板视图；入口不占会话页签——页签按钮由 DOM 层隐藏（宿主 viewTabs
// 无隐藏选项），激活走程序化点击同一条 ui-conversation actions.setView 路径，切回用可见的 对话/轨迹 页签。
// 入口：dsh-client-ui-sidebar 的 sidebar.footer.action 插槽（kind: list, scope: root）——
// SidebarRoot 底部 footArea 先渲染 footer.action 再渲染 settings，占用者天然位于 Settings 按钮正上方
// （cordis-panel 同款接入）；宿主经 renderSlot 只传 { wide: boolean }（true=展开侧栏，false=56px 收起轨道）。
// ADR-12 嵌入路径 A（iframe 直连 http://127.0.0.1:<port>/，M4 已证 SSE 在线）。
// 构建产物为 window.__ModuleLoader__.load({ id, factory: (require) => ... }) 包装（scripts/build.mjs）。
// react 为 peer external：esbuild CJS 输出把下面的 import 转为 require("react")，由宿主 ModuleLoader 注入。
import { createElement, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createTaskboardStore, ensureProductStageChrome, readConversationBox } from "./stage";

/** 客户端 cordis 服务依赖（服务名）：slots=视图页签/侧栏入口注册；sessions=「在对话中打开」（taskboard:open-thread → ctx.sessions.open，in-box workflow-run 同款）；layout=收起轨道图标钮先展开侧栏（ctx.layout.toggleSidebar，ui-sidebar 自身折叠钮同款调用）；locale=侧栏入口标签按宿主语言显示。 */
export const inject = ["slots", "sessions", "locale"];

/** 侧栏入口本地化字典（与 dsh-omnimux 同款 NS + zh/en 结构）。 */
const NS = "dsh-taskboard-plugin";
const zh = { "nav.taskboard": "任务看板" };
const en = { "nav.taskboard": "Taskboard" };

/** ADR-12 约定默认端口（host 配置未覆盖时的回退值）。 */
const DEFAULT_PORT = 47823;

/** host 半边注册的同源 port 通道（见 host.ts apply；exact 路由，GUI 自身 origin）。 */
const PORT_CHANNEL_URL = "/plugins/taskboard/config.json";

/** host 状态通道判定：这两种状态才值得挂 iframe（盲探会被端口上的任意 200 占用者骗过）。 */
function hostStatusServes(status: unknown): boolean {
  return status === "ready" || status === "adopted";
}

/** 解析实际端口与 host 监督器状态：同源 config.json 优先，失败回退约定默认（状态未知）。 */
async function resolveChannel(signal: AbortSignal): Promise<{ port: number; status: unknown }> {
  try {
    const response = await fetch(PORT_CHANNEL_URL, { signal });
    if (!response.ok) return { port: DEFAULT_PORT, status: undefined };
    const data: unknown = await response.json();
    const channel = data as { port?: unknown; status?: unknown } | null;
    const port = channel?.port;
    if (typeof port === "number" && Number.isInteger(port) && port > 0 && port < 65536) {
      return { port, status: channel?.status };
    }
    return { port: DEFAULT_PORT, status: channel?.status };
  } catch {
    return { port: DEFAULT_PORT, status: undefined };
  }
}

/** 探测 taskboard 服务存活：no-cors 盲探（跨源无 CORS 头可读；opaque 响应足以判活）。 */
async function probeHealth(origin: string, signal: AbortSignal): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  const onOuterAbort = () => controller.abort();
  signal.addEventListener("abort", onOuterAbort, { once: true });
  try {
    await fetch(`${origin}/health`, { mode: "no-cors", signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onOuterAbort);
  }
}

type ViewPhase = "resolving" | "loading" | "ready" | "down";

/** 主题 token 引用（全部带 fallback，theme-tokens.md §3 纪律）。 */
const tokens = {
  bgBase: "var(--dsw-alias-bg-base, #fff)",
  borderL2: "var(--dsw-alias-border-l2, rgba(128,128,128,.25))",
  labelPrimary: "var(--dsw-alias-label-primary, inherit)",
  labelSecondary: "var(--dsw-alias-label-secondary, inherit)",
};

/**
 * 通道解析 + 健康探测共用核心（会话页签视图与侧栏内嵌面板同一路径）：
 * 挂载 → 同源解析端口 → /health 双闸探测；retry 供降级屏「重试」按钮重跑整个流程；
 * markReady 供 iframe onLoad 熄灭加载覆盖层。卸载时 effect 清理中止在途探测。
 */
function useTaskboardChannel() {
  const [phase, setPhase] = useState<ViewPhase>("resolving");
  const [origin, setOrigin] = useState(`http://127.0.0.1:${DEFAULT_PORT}`);
  const [hostStatus, setHostStatus] = useState<unknown>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setPhase("resolving");
    setHostStatus(undefined);
    const attempt = async () => {
      const channel = await resolveChannel(controller.signal);
      const resolvedOrigin = `http://127.0.0.1:${channel.port}`;
      if (cancelled) return;
      setOrigin(resolvedOrigin);
      setHostStatus(channel.status);
      // 双闸：host 监督器状态（权威）+ no-cors 盲探（兜底刚崩溃的窄窗）。
      const healthy = hostStatusServes(channel.status)
        && await probeHealth(resolvedOrigin, controller.signal);
      if (cancelled) return;
      setPhase(healthy ? "loading" : "down");
    };
    attempt().catch(() => {
      if (!cancelled) setPhase("down");
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const retry = () => {
    setPhase("resolving");
    void (async () => {
      const controller = new AbortController();
      const channel = await resolveChannel(controller.signal);
      const resolvedOrigin = `http://127.0.0.1:${channel.port}`;
      setOrigin(resolvedOrigin);
      setHostStatus(channel.status);
      const healthy = hostStatusServes(channel.status)
        && await probeHealth(resolvedOrigin, controller.signal);
      setPhase(healthy ? "loading" : "down");
    })().catch(() => setPhase("down"));
  };

  return { phase, origin, hostStatus, retry, markReady: () => setPhase("ready") };
}

/**
 * 看板帧渲染核心（不含外壳工具栏）：phase=ready/loading → iframe 直连（ADR-12 路径 A），
 * 加载覆盖层在 iframe onLoad 后消失；其余 → 降级屏（提示 + [重试] + [在系统浏览器打开]）。
 * frameTitle 必须按挂载面区分：会话页签固定 "Taskboard"——postMessage 桥按
 * iframe[title="Taskboard"] 属性精确选择，只允许命中会话页签帧；侧栏内嵌面板用
 * "Taskboard Sidebar"，属性精确匹配不会命中它，桥的语义保持不变。
 */
function BoardFrame(props: {
  phase: ViewPhase;
  origin: string;
  hostStatus: unknown;
  retry: () => void;
  markReady: () => void;
  frameTitle: string;
}) {
  const { phase, origin, hostStatus, retry, markReady, frameTitle } = props;
  if (phase === "ready" || phase === "loading") {
    return createElement(
      "div",
      { style: { position: "relative", flex: 1, minHeight: 0 } },
      createElement("iframe", {
        src: `${origin}/`,
        title: frameTitle,
        // 跨源 iframe 的剪贴板写授权：无此声明时 Chrome 拒绝 navigator.clipboard.writeText
        // （execCommand 兜底也会被静默吞掉），看板内「复制 ID/复制链接」会报「无法写入剪贴板」。
        allow: "clipboard-write",
        onLoad: markReady,
        style: {
          width: "100%",
          height: "100%",
          border: "none",
          background: "#fff",
          display: "block",
        },
      }),
      phase === "loading"
        ? createElement(
            "div",
            {
              style: {
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                fontSize: 13,
                color: tokens.labelSecondary,
                background: tokens.bgBase,
              },
            },
            "Taskboard 加载中…",
          )
        : null,
    );
  }
  return createElement(
    "div",
    {
      style: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        fontSize: 13,
        color: tokens.labelSecondary,
      },
      "data-taskboard-degraded": true,
    },
    createElement(
      "div",
      null,
      phase === "resolving"
        ? "正在连接 Taskboard 服务…"
        : `Taskboard 服务未启动${typeof hostStatus === "string" ? `（host 状态: ${hostStatus}）` : ""}`,
    ),
    createElement(
      "div",
      { style: { display: "flex", gap: 8 } },
      createElement(
        "button",
        {
          onClick: retry,
          style: {
            cursor: "pointer",
            padding: "6px 14px",
            fontSize: 13,
            borderRadius: 8,
            border: `1px solid ${tokens.borderL2}`,
            background: "transparent",
            color: tokens.labelPrimary,
          },
        },
        "重试",
      ),
      createElement(
        "button",
        {
          onClick: () => window.open(origin, "_blank", "noopener"),
          style: {
            cursor: "pointer",
            padding: "6px 14px",
            fontSize: 13,
            borderRadius: 8,
            border: `1px solid ${tokens.borderL2}`,
            background: "transparent",
            color: tokens.labelPrimary,
          },
        },
        "在系统浏览器打开",
      ),
    ),
  );
}

/**
 * Independent first-level page (shell.overlay), not a session view.
 * Covers the whole conversation column so session header / composer stay underneath.
 */
function TaskboardStage(props: {
  t: (key: string) => string;
  board: ReturnType<typeof createTaskboardStore>;
  useSessions?: (select: (state: { current?: string }) => unknown) => unknown;
}) {
  const { t, board, useSessions } = props;
  const open = useSyncExternalStore(
    board ? board.subscribe : () => () => {},
    board ? board.getSnapshot : () => false,
  );
  const channel = useTaskboardChannel();
  const readSessions = useSessions ?? ((select) => select({}));
  const currentSession = readSessions((state) => state.current);
  const [box, setBox] = useState(() => readConversationBox());
  const lastSession = useRef(currentSession);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const update = () => {
      setBox(readConversationBox());
    };
    update();
    const target = document.querySelector('[data-slot="conversation"]')?.parentElement
      ?? document.querySelector("[data-conversation-scroll]");
    const observer = typeof ResizeObserver === "function" && target instanceof Element
      ? new ResizeObserver(update)
      : null;
    if (target && observer) observer.observe(target);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (open && lastSession.current !== currentSession) board?.set(false);
    lastSession.current = currentSession;
  }, [board, currentSession, open]);

  if (!open || !board) return null;
  return createElement(
    "div",
    {
      role: "region",
      "aria-label": t("nav.taskboard"),
      "data-taskboard-stage": true,
      style: {
        position: "fixed",
        top: box.top,
        left: box.left,
        width: box.width,
        height: box.height,
        zIndex: 20,
        pointerEvents: "auto",
        display: "flex",
        flexDirection: "column",
        background: tokens.bgBase,
        color: tokens.labelPrimary,
      },
    },
    createElement(BoardFrame, { ...channel, frameTitle: "Taskboard" }),
  );
}

/** 宿主 → iframe 的 ack 通道（thread-prepared / thread-create-error，App.tsx receiveHostMessage 既有协议）。 */
function postToTaskboardFrame(message: Record<string, unknown>) {
  const frame = document.querySelector('iframe[title="Taskboard"]') as HTMLIFrameElement | null;
  frame?.contentWindow?.postMessage(message, "*");
}

/**
 * 侧栏「新会话下方」入口（DOM 注入，替代 sidebar.footer.action）。
 * OmniMux 期望「应用」与「任务看板」都挂在新会话下方：应用入口由 dsh-omnimux 以
 * [data-dsh-omnimux-apps-entry] 挂在新会话正下方，本入口插到它之后（任务排在应用之下）；
 * 应用尚未挂载时退化为紧跟新会话。observer + 2s 重试自愈，与 dsh-omnimux 同款挂法。
 */
const APPS_ENTRY_SELECTOR = '[data-dsh-omnimux-apps-entry]';
const TASKBOARD_ICON_SVG =
  '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true"><rect x="1.75" y="2" width="3.5" height="12" rx="1" fill="currentColor"/><rect x="6.25" y="2" width="3.5" height="8" rx="1" fill="currentColor"/><rect x="10.75" y="2" width="3.5" height="10" rx="1" fill="currentColor"/></svg>';

function injectTaskboardEntryStyles(): void {
  if (document.getElementById("dsh-taskboard-entry-styles")) return;
  const style = document.createElement("style");
  style.id = "dsh-taskboard-entry-styles";
  style.textContent = [
    ".dsh-taskboard-entry{box-sizing:border-box;display:flex;align-items:center;gap:6px;position:relative;",
    "width:calc(100% - 8px);height:32px;margin:0 4px;padding:0 8px;border:none;border-radius:8px;",
    "background:transparent;color:var(--dsw-alias-label-primary,inherit);",
    "font:var(--dsw-font-s-14,inherit);font-size:14px;line-height:20px;cursor:pointer;text-align:left;}",
    ".dsh-taskboard-entry:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12));}",
    ".dsh-taskboard-entry-icon{flex:none;display:inline-flex;width:14px;height:14px;align-items:center;justify-content:center;}",
    ".dsh-taskboard-entry svg{display:block;width:14px;height:14px;}",
    ".dsh-taskboard-entry-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:20px;}",
  ].join("");
  document.head.append(style);
}

function findSidebarRoot(): HTMLElement | undefined {
  const column = document.querySelector('[data-pane="sidebar"], [class*="sidebarCol"]');
  if (!(column instanceof HTMLElement)) return undefined;
  const logoOwner = column.querySelector('[class*="logoRow"]')?.parentElement;
  if (logoOwner instanceof HTMLElement) return logoOwner;
  return column.firstElementChild instanceof HTMLElement ? column.firstElementChild : undefined;
}

function findNewSessionButton(root: HTMLElement): HTMLButtonElement | undefined {
  const nested = root.querySelector('button[class*="newSession"]');
  if (nested instanceof HTMLButtonElement) return nested;
  for (const child of root.children) if (child instanceof HTMLButtonElement) return child;
  const byAria = root.querySelector(
    'button[aria-label="新建会话"], button[aria-label="New Session"], button[aria-label*="新会话"], button[aria-label*="new session" i]',
  );
  if (byAria instanceof HTMLButtonElement) return byAria;
  return Array.from(root.querySelectorAll("button")).find((button) =>
    /新会话|新建会话|new session/i.test(button.textContent ?? ""),
  ) as HTMLButtonElement | undefined;
}

function paintTaskboardLabel(entry: HTMLButtonElement, label: string): void {
  entry.setAttribute("aria-label", label);
  const node = entry.querySelector(".dsh-taskboard-entry-label");
  if (node) node.textContent = label;
}

/** 挂载任务看板侧栏入口，返回清理函数。 */
function mountTaskboardEntry(
  board: ReturnType<typeof createTaskboardStore>,
  t: (key: string) => string,
  locale?: { subscribe?: (fn: () => void) => () => void },
): () => void {
  injectTaskboardEntryStyles();
  const entry = document.createElement("button");
  entry.type = "button";
  entry.dataset.dshTaskboardEntry = "";
  entry.className = "dsh-taskboard-entry";
  entry.innerHTML =
    `<span class="dsh-taskboard-entry-icon">${TASKBOARD_ICON_SVG}</span>` +
    `<span class="dsh-taskboard-entry-label"></span>`;
  const paint = () => { paintTaskboardLabel(entry, t("nav.taskboard")); };
  paint();
  entry.addEventListener("click", () => board.toggle());
  const syncActive = () => {
    if (board.getSnapshot()) entry.dataset.active = "true";
    else delete entry.dataset.active;
  };
  const unsubscribe = board.subscribe(syncActive);
  const unsubscribeLocale = typeof locale?.subscribe === "function" ? locale.subscribe(paint) : () => {};
  syncActive();

  let root: HTMLElement | undefined;
  let placed = false;

  const anchorOf = (): HTMLElement | undefined => {
    if (root === undefined) return undefined;
    const apps = root.querySelector<HTMLElement>(APPS_ENTRY_SELECTOR);
    if (apps !== null) return apps;
    return findNewSessionButton(root);
  };

  const place = (): boolean => {
    root ??= findSidebarRoot();
    if (root === undefined) return false;
    const anchor = anchorOf();
    if (anchor === undefined) return false;
    if (entry.parentElement === root && entry.previousElementSibling === anchor) return true;
    const next = anchor.nextElementSibling;
    root.insertBefore(entry, next === entry ? entry.nextElementSibling : next);
    return true;
  };

  const tryPlace = (): void => {
    if (root !== undefined && !root.isConnected) {
      rootObserver.disconnect();
      root = undefined;
      placed = false;
    }
    if (placed && !document.body.contains(entry)) {
      rootObserver.disconnect();
      root = undefined;
      placed = false;
    }
    placed = place();
    if (placed && root !== undefined) rootObserver.observe(root, { childList: true, subtree: true });
  };

  const waitObserver = new MutationObserver(tryPlace);
  waitObserver.observe(document.body, { childList: true, subtree: true });

  const rootObserver = new MutationObserver(() => {
    if (root === undefined || !root.isConnected) {
      placed = false;
      tryPlace();
      return;
    }
    const anchor = anchorOf();
    if (!root.contains(entry) || (anchor !== undefined && entry.previousElementSibling !== anchor)) {
      placed = place();
    }
  });

  const retry = setInterval(tryPlace, 2000);
  tryPlace();

  return () => {
    clearInterval(retry);
    waitObserver.disconnect();
    rootObserver.disconnect();
    unsubscribe();
    unsubscribeLocale();
    entry.remove();
  };
}

/**
 * 注册形状：ctx.slots.inject(name, factory)（slot-notes §6 权威形状）——
 * 声明方重挂载/重建声明时按声明 epoch 自动重注册。
 */
export function apply(ctx: any) {
  ctx.effect(() => {
    ensureProductStageChrome();
    return () => {};
  }, "taskboard: product-stage chrome");
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "taskboard: dictionaries");
  const t = ctx.locale.bind(NS);
  const board = createTaskboardStore();
  // 「在对话中打开」双协议桥（iframe → 宿主 postMessage，上游既有通道，DSH 前无宿主监听）：
  // · taskboard:open-thread {threadId}——打开已绑定会话：ctx.sessions.open（目标会话默认落在 chat 视图）。
  // · taskboard:create-thread {taskId, workspacePath,…}——新建 DSH 会话（sessions.create({cwd})，
  //   connectWorkspace 同款、返回 session id）→ PATCH taskboard API 把 threadId 绑到议题
  //   （与工具面 issue_create 的 bare threadId 绑定同一路径）→ 回 thread-prepared ack → 打开。
  ctx.effect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as {
        type?: string;
        payload?: { threadId?: unknown; taskId?: unknown; workspacePath?: unknown };
      } | null;
      if (!data || typeof data.type !== "string") return;
      if (data.type === "taskboard:open-thread") {
        const threadId = typeof data.payload?.threadId === "string" ? data.payload.threadId.trim() : "";
        if (!threadId) return;
        board.set(false);
        ctx.sessions.open(threadId);
        return;
      }
      if (data.type === "taskboard:create-thread") {
        const taskId = typeof data.payload?.taskId === "string" ? data.payload.taskId : "";
        if (!taskId) return;
        const workspacePath = typeof data.payload?.workspacePath === "string"
          ? data.payload.workspacePath.trim()
          : "";
        void (async () => {
          try {
            const threadId = await ctx.sessions.create(workspacePath ? { cwd: workspacePath } : {});
            const bind = await fetch("/plugins/taskboard/bind-task", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ taskId, threadId }),
            });
            if (!bind.ok) throw new Error(`bind-task ${bind.status}`);
            postToTaskboardFrame({ type: "taskboard:thread-prepared", payload: { taskId, threadId } });
            board.set(false);
            ctx.sessions.open(threadId);
          } catch (error) {
            postToTaskboardFrame({
              type: "taskboard:thread-create-error",
              payload: { taskId, error: String((error as Error)?.message ?? error) },
            });
          }
        })();
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, "taskboard: open-thread bridge");
  ctx.slots.inject("shell.overlay", () =>
    ctx.slots.register(
      {
        name: "shell.overlay",
        id: "taskboard-stage",
        order: 22,
        locale: NS,
        inject: () => ({ t, board }),
      },
      TaskboardStage,
    ),
  );
  ctx.effect(() => mountTaskboardEntry(board, t, ctx.locale), "taskboard: sidebar entry under new session");
}
