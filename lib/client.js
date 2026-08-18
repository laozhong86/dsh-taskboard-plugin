window.__ModuleLoader__.load({
	id: "dsh-taskboard-plugin",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		"use strict";
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __export = (target, all) => {
		  for (var name in all)
		    __defProp(target, name, { get: all[name], enumerable: true });
		};
		var __copyProps = (to, from, except, desc) => {
		  if (from && typeof from === "object" || typeof from === "function") {
		    for (let key of __getOwnPropNames(from))
		      if (!__hasOwnProp.call(to, key) && key !== except)
		        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
		  }
		  return to;
		};
		var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
		
		// src/client/index.ts
		var index_exports = {};
		__export(index_exports, {
		  apply: () => apply,
		  inject: () => inject
		});
		module.exports = __toCommonJS(index_exports);
		var import_react = require("react");
		
		// src/client/stage.ts
		var PRODUCT_STAGE_EVENT = "dsh-product-stage";
		var STAGE_ID = "taskboard";
		function claimProductStage(id) {
		  window.dispatchEvent(new CustomEvent(PRODUCT_STAGE_EVENT, { detail: { id } }));
		  document.documentElement.dataset.dshProductStage = id;
		  ensureProductStageChrome();
		}
		function releaseProductStage(id) {
		  if (document.documentElement.dataset.dshProductStage === id) {
		    delete document.documentElement.dataset.dshProductStage;
		  }
		}
		var PRODUCT_STAGE_CHROME = [
		  '[data-slot="shell.overlay"]{pointer-events:none!important;}',
		  'html:not([data-dsh-product-stage]) [class*="toggleCluster"],',
		  'html:not([data-dsh-product-stage]) [class*="toggleCluster"] *{pointer-events:auto!important;z-index:300!important;}',
		  'html[data-dsh-product-stage] [class*="toggleCluster"]{display:none!important;}',
		  "html[data-dsh-product-stage] #dsh-window-drag{-webkit-app-region:no-drag!important;pointer-events:none!important;}",
		  "html[data-dsh-product-stage] header{-webkit-app-region:no-drag!important;}"
		].join("");
		function ensureProductStageChrome() {
		  const existing = document.getElementById("dsh-product-stage-chrome");
		  if (existing instanceof HTMLStyleElement) {
		    if (!existing.textContent?.includes("dsh-window-drag")) existing.textContent = PRODUCT_STAGE_CHROME;
		  } else {
		    const style = document.createElement("style");
		    style.id = "dsh-product-stage-chrome";
		    style.textContent = PRODUCT_STAGE_CHROME;
		    document.head.append(style);
		  }
		  watchSelectedSessionClick();
		}
		function watchSelectedSessionClick() {
		  if (document.documentElement.dataset.dshSessionCloser === "1") return;
		  document.documentElement.dataset.dshSessionCloser = "1";
		  document.addEventListener(
		    "click",
		    (event) => {
		      if (!document.documentElement.dataset.dshProductStage) return;
		      const target = event.target;
		      if (!(target instanceof Element)) return;
		      const row = target.closest('[role="treeitem"][aria-selected="true"]');
		      if (!(row instanceof HTMLElement)) return;
		      if (target.closest("button") !== null) return;
		      delete document.documentElement.dataset.dshProductStage;
		      window.dispatchEvent(new CustomEvent(PRODUCT_STAGE_EVENT, { detail: { id: "" } }));
		    },
		    true
		  );
		}
		function createTaskboardStore() {
		  let open = false;
		  const listeners = /* @__PURE__ */ new Set();
		  function emit() {
		    for (const listener of listeners) listener();
		  }
		  window.addEventListener(PRODUCT_STAGE_EVENT, (event) => {
		    const id = event instanceof CustomEvent ? event.detail?.id : void 0;
		    if (id !== STAGE_ID && open) {
		      open = false;
		      emit();
		    }
		  });
		  return {
		    getSnapshot: () => open,
		    subscribe(listener) {
		      listeners.add(listener);
		      return () => {
		        listeners.delete(listener);
		      };
		    },
		    set(next) {
		      if (open === next) return;
		      open = next;
		      if (open) claimProductStage(STAGE_ID);
		      else releaseProductStage(STAGE_ID);
		      emit();
		    },
		    toggle() {
		      this.set(!open);
		    }
		  };
		}
		function sizableBox(node) {
		  if (!node || typeof node.getBoundingClientRect !== "function") return null;
		  const rect = node.getBoundingClientRect();
		  if (rect.width >= 8 && rect.height >= 8) {
		    return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
		  }
		  return null;
		}
		function readConversationBox() {
		  let node = document.querySelector('[data-slot="conversation"]');
		  while (node) {
		    const box = sizableBox(node);
		    if (box) return box;
		    node = node.parentElement;
		  }
		  const preferred = sizableBox(document.querySelector("[data-conversation-scroll]"));
		  if (preferred) return preferred;
		  const left = 56;
		  return { top: 0, left, width: Math.max(8, window.innerWidth - left), height: Math.max(8, window.innerHeight) };
		}
		
		// src/client/index.ts
		var inject = ["slots", "sessions", "locale"];
		var NS = "dsh-taskboard-plugin";
		var zh = { "nav.taskboard": "\u4EFB\u52A1\u770B\u677F" };
		var en = { "nav.taskboard": "Taskboard" };
		var DEFAULT_PORT = 47823;
		var PORT_CHANNEL_URL = "/plugins/taskboard/config.json";
		function hostStatusServes(status) {
		  return status === "ready" || status === "adopted";
		}
		async function resolveChannel(signal) {
		  try {
		    const response = await fetch(PORT_CHANNEL_URL, { signal });
		    if (!response.ok) return { port: DEFAULT_PORT, status: void 0 };
		    const data = await response.json();
		    const channel = data;
		    const port = channel?.port;
		    if (typeof port === "number" && Number.isInteger(port) && port > 0 && port < 65536) {
		      return { port, status: channel?.status };
		    }
		    return { port: DEFAULT_PORT, status: channel?.status };
		  } catch {
		    return { port: DEFAULT_PORT, status: void 0 };
		  }
		}
		async function probeHealth(origin, signal) {
		  const controller = new AbortController();
		  const timer = setTimeout(() => controller.abort(), 3e3);
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
		var tokens = {
		  bgBase: "var(--dsw-alias-bg-base, #fff)",
		  borderL2: "var(--dsw-alias-border-l2, rgba(128,128,128,.25))",
		  labelPrimary: "var(--dsw-alias-label-primary, inherit)",
		  labelSecondary: "var(--dsw-alias-label-secondary, inherit)"
		};
		function useTaskboardChannel() {
		  const [phase, setPhase] = (0, import_react.useState)("resolving");
		  const [origin, setOrigin] = (0, import_react.useState)(`http://127.0.0.1:${DEFAULT_PORT}`);
		  const [hostStatus, setHostStatus] = (0, import_react.useState)(void 0);
		  (0, import_react.useEffect)(() => {
		    const controller = new AbortController();
		    let cancelled = false;
		    setPhase("resolving");
		    setHostStatus(void 0);
		    const attempt = async () => {
		      const channel = await resolveChannel(controller.signal);
		      const resolvedOrigin = `http://127.0.0.1:${channel.port}`;
		      if (cancelled) return;
		      setOrigin(resolvedOrigin);
		      setHostStatus(channel.status);
		      const healthy = hostStatusServes(channel.status) && await probeHealth(resolvedOrigin, controller.signal);
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
		      const healthy = hostStatusServes(channel.status) && await probeHealth(resolvedOrigin, controller.signal);
		      setPhase(healthy ? "loading" : "down");
		    })().catch(() => setPhase("down"));
		  };
		  return { phase, origin, hostStatus, retry, markReady: () => setPhase("ready") };
		}
		function BoardFrame(props) {
		  const { phase, origin, hostStatus, retry, markReady, frameTitle } = props;
		  if (phase === "ready" || phase === "loading") {
		    return (0, import_react.createElement)(
		      "div",
		      { style: { position: "relative", flex: 1, minHeight: 0 } },
		      (0, import_react.createElement)("iframe", {
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
		          display: "block"
		        }
		      }),
		      phase === "loading" ? (0, import_react.createElement)(
		        "div",
		        {
		          style: {
		            position: "absolute",
		            inset: 0,
		            display: "grid",
		            placeItems: "center",
		            fontSize: 13,
		            color: tokens.labelSecondary,
		            background: tokens.bgBase
		          }
		        },
		        "Taskboard \u52A0\u8F7D\u4E2D\u2026"
		      ) : null
		    );
		  }
		  return (0, import_react.createElement)(
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
		        color: tokens.labelSecondary
		      },
		      "data-taskboard-degraded": true
		    },
		    (0, import_react.createElement)(
		      "div",
		      null,
		      phase === "resolving" ? "\u6B63\u5728\u8FDE\u63A5 Taskboard \u670D\u52A1\u2026" : `Taskboard \u670D\u52A1\u672A\u542F\u52A8${typeof hostStatus === "string" ? `\uFF08host \u72B6\u6001: ${hostStatus}\uFF09` : ""}`
		    ),
		    (0, import_react.createElement)(
		      "div",
		      { style: { display: "flex", gap: 8 } },
		      (0, import_react.createElement)(
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
		            color: tokens.labelPrimary
		          }
		        },
		        "\u91CD\u8BD5"
		      ),
		      (0, import_react.createElement)(
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
		            color: tokens.labelPrimary
		          }
		        },
		        "\u5728\u7CFB\u7EDF\u6D4F\u89C8\u5668\u6253\u5F00"
		      )
		    )
		  );
		}
		function TaskboardStage(props) {
		  const { t, board, useSessions } = props;
		  const open = (0, import_react.useSyncExternalStore)(
		    board ? board.subscribe : () => () => {
		    },
		    board ? board.getSnapshot : () => false
		  );
		  const channel = useTaskboardChannel();
		  const readSessions = useSessions ?? ((select) => select({}));
		  const currentSession = readSessions((state) => state.current);
		  const [box, setBox] = (0, import_react.useState)(() => readConversationBox());
		  const lastSession = (0, import_react.useRef)(currentSession);
		  (0, import_react.useLayoutEffect)(() => {
		    if (!open) return void 0;
		    const update = () => {
		      setBox(readConversationBox());
		    };
		    update();
		    const target = document.querySelector('[data-slot="conversation"]')?.parentElement ?? document.querySelector("[data-conversation-scroll]");
		    const observer = typeof ResizeObserver === "function" && target instanceof Element ? new ResizeObserver(update) : null;
		    if (target && observer) observer.observe(target);
		    window.addEventListener("resize", update);
		    return () => {
		      observer?.disconnect();
		      window.removeEventListener("resize", update);
		    };
		  }, [open]);
		  (0, import_react.useLayoutEffect)(() => {
		    if (open && lastSession.current !== currentSession) board?.set(false);
		    lastSession.current = currentSession;
		  }, [board, currentSession, open]);
		  if (!open || !board) return null;
		  return (0, import_react.createElement)(
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
		        padding: "56px 0 0",
		        boxSizing: "border-box",
		        background: tokens.bgBase,
		        color: tokens.labelPrimary
		      }
		    },
		    (0, import_react.createElement)(BoardFrame, { ...channel, frameTitle: "Taskboard" })
		  );
		}
		function postToTaskboardFrame(message) {
		  const frame = document.querySelector('iframe[title="Taskboard"]');
		  frame?.contentWindow?.postMessage(message, "*");
		}
		var APPS_ENTRY_SELECTOR = "[data-dsh-omnimux-apps-entry]";
		var TASKBOARD_ICON_SVG = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true"><rect x="1.75" y="2" width="3.5" height="12" rx="1" fill="currentColor"/><rect x="6.25" y="2" width="3.5" height="8" rx="1" fill="currentColor"/><rect x="10.75" y="2" width="3.5" height="10" rx="1" fill="currentColor"/></svg>';
		function injectTaskboardEntryStyles() {
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
		    ".dsh-taskboard-entry-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:20px;}"
		  ].join("");
		  document.head.append(style);
		}
		function findSidebarRoot() {
		  const column = document.querySelector('[data-pane="sidebar"], [class*="sidebarCol"]');
		  if (!(column instanceof HTMLElement)) return void 0;
		  const logoOwner = column.querySelector('[class*="logoRow"]')?.parentElement;
		  if (logoOwner instanceof HTMLElement) return logoOwner;
		  return column.firstElementChild instanceof HTMLElement ? column.firstElementChild : void 0;
		}
		function findNewSessionButton(root) {
		  const nested = root.querySelector('button[class*="newSession"]');
		  if (nested instanceof HTMLButtonElement) return nested;
		  for (const child of root.children) if (child instanceof HTMLButtonElement) return child;
		  const byAria = root.querySelector(
		    'button[aria-label="\u65B0\u5EFA\u4F1A\u8BDD"], button[aria-label="New Session"], button[aria-label*="\u65B0\u4F1A\u8BDD"], button[aria-label*="new session" i]'
		  );
		  if (byAria instanceof HTMLButtonElement) return byAria;
		  return Array.from(root.querySelectorAll("button")).find(
		    (button) => /新会话|新建会话|new session/i.test(button.textContent ?? "")
		  );
		}
		function paintTaskboardLabel(entry, label) {
		  entry.setAttribute("aria-label", label);
		  const node = entry.querySelector(".dsh-taskboard-entry-label");
		  if (node) node.textContent = label;
		}
		function mountTaskboardEntry(board, t, locale) {
		  injectTaskboardEntryStyles();
		  const entry = document.createElement("button");
		  entry.type = "button";
		  entry.dataset.dshTaskboardEntry = "";
		  entry.className = "dsh-taskboard-entry";
		  entry.innerHTML = `<span class="dsh-taskboard-entry-icon">${TASKBOARD_ICON_SVG}</span><span class="dsh-taskboard-entry-label"></span>`;
		  const paint = () => {
		    paintTaskboardLabel(entry, t("nav.taskboard"));
		  };
		  paint();
		  entry.addEventListener("click", () => board.toggle());
		  const syncActive = () => {
		    if (board.getSnapshot()) entry.dataset.active = "true";
		    else delete entry.dataset.active;
		  };
		  const unsubscribe = board.subscribe(syncActive);
		  const unsubscribeLocale = typeof locale?.subscribe === "function" ? locale.subscribe(paint) : () => {
		  };
		  syncActive();
		  let root;
		  let placed = false;
		  const anchorOf = () => {
		    if (root === void 0) return void 0;
		    const apps = root.querySelector(APPS_ENTRY_SELECTOR);
		    if (apps !== null) return apps;
		    return findNewSessionButton(root);
		  };
		  const place = () => {
		    root ??= findSidebarRoot();
		    if (root === void 0) return false;
		    const anchor = anchorOf();
		    if (anchor === void 0) return false;
		    if (entry.parentElement === root && entry.previousElementSibling === anchor) return true;
		    const next = anchor.nextElementSibling;
		    root.insertBefore(entry, next === entry ? entry.nextElementSibling : next);
		    return true;
		  };
		  const tryPlace = () => {
		    if (root !== void 0 && !root.isConnected) {
		      rootObserver.disconnect();
		      root = void 0;
		      placed = false;
		    }
		    if (placed && !document.body.contains(entry)) {
		      rootObserver.disconnect();
		      root = void 0;
		      placed = false;
		    }
		    placed = place();
		    if (placed && root !== void 0) rootObserver.observe(root, { childList: true, subtree: true });
		  };
		  const waitObserver = new MutationObserver(tryPlace);
		  waitObserver.observe(document.body, { childList: true, subtree: true });
		  const rootObserver = new MutationObserver(() => {
		    if (root === void 0 || !root.isConnected) {
		      placed = false;
		      tryPlace();
		      return;
		    }
		    const anchor = anchorOf();
		    if (!root.contains(entry) || anchor !== void 0 && entry.previousElementSibling !== anchor) {
		      placed = place();
		    }
		  });
		  const retry = setInterval(tryPlace, 2e3);
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
		function apply(ctx) {
		  ctx.effect(() => {
		    ensureProductStageChrome();
		    return () => {
		    };
		  }, "taskboard: product-stage chrome");
		  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "taskboard: dictionaries");
		  const t = ctx.locale.bind(NS);
		  const board = createTaskboardStore();
		  ctx.effect(() => {
		    const onMessage = (event) => {
		      const data = event.data;
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
		        const workspacePath = typeof data.payload?.workspacePath === "string" ? data.payload.workspacePath.trim() : "";
		        void (async () => {
		          try {
		            const threadId = await ctx.sessions.create(workspacePath ? { cwd: workspacePath } : {});
		            const bind = await fetch("/plugins/taskboard/bind-task", {
		              method: "POST",
		              headers: { "content-type": "application/json" },
		              body: JSON.stringify({ taskId, threadId })
		            });
		            if (!bind.ok) throw new Error(`bind-task ${bind.status}`);
		            postToTaskboardFrame({ type: "taskboard:thread-prepared", payload: { taskId, threadId } });
		            board.set(false);
		            ctx.sessions.open(threadId);
		          } catch (error) {
		            postToTaskboardFrame({
		              type: "taskboard:thread-create-error",
		              payload: { taskId, error: String(error?.message ?? error) }
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
		  ctx.slots.inject(
		    "shell.overlay",
		    () => ctx.slots.register(
		      {
		        name: "shell.overlay",
		        id: "taskboard-stage",
		        order: 22,
		        locale: NS,
		        inject: () => ({ t, board })
		      },
		      TaskboardStage
		    )
		  );
		  ctx.effect(() => mountTaskboardEntry(board, t, ctx.locale), "taskboard: sidebar entry under new session");
		}
		
		return module.exports;
	}
});
