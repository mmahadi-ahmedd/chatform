/*! ChatForm embed script — <script src="https://YOUR-APP/embed.js" data-form="FORM_SLUG" async></script> */
(function () {
  var script = document.currentScript;
  if (!script) {
    var all = document.querySelectorAll("script[data-form]");
    script = all[all.length - 1];
  }
  if (!script || window.__chatformLoaded) return;
  var slug = script.getAttribute("data-form");
  if (!slug) return console.error("[ChatForm] Missing data-form attribute");
  window.__chatformLoaded = true;
  var origin = new URL(script.src, location.href).origin;
  var position = script.getAttribute("data-position") === "left" ? "left" : "right";
  var color = script.getAttribute("data-color") || "#4f46e5";
  var open = false;

  function init(cfgColor) {
    var wrap = document.createElement("div");
    wrap.id = "chatform-widget";
    var style = document.createElement("style");
    style.textContent =
      "#chatform-btn{position:fixed;bottom:20px;" + position + ":20px;width:60px;height:60px;border-radius:50%;border:0;cursor:pointer;" +
      "box-shadow:0 6px 20px rgba(0,0,0,.25);z-index:2147483646;display:flex;align-items:center;justify-content:center;font-size:26px;color:#fff;transition:transform .15s}" +
      "#chatform-btn:hover{transform:scale(1.07)}" +
      "#chatform-frame{position:fixed;bottom:92px;" + position + ":20px;width:380px;height:600px;max-height:calc(100vh - 112px);border:0;border-radius:16px;" +
      "box-shadow:0 12px 40px rgba(0,0,0,.28);z-index:2147483647;background:#fff;display:none}" +
      "@media (max-width:480px){#chatform-frame{inset:0;bottom:0;left:0;right:0;width:100%;height:100%;max-height:none;border-radius:0}}";
    var btn = document.createElement("button");
    btn.id = "chatform-btn";
    btn.setAttribute("aria-label", "Open chat");
    btn.style.background = cfgColor;
    btn.textContent = "💬";
    var frame = document.createElement("iframe");
    frame.id = "chatform-frame";
    frame.title = "Chat";
    frame.setAttribute("allow", "clipboard-write");
    var loaded = false;

    function toggle(show) {
      open = typeof show === "boolean" ? show : !open;
      if (open && !loaded) {
        frame.src = origin + "/widget/" + encodeURIComponent(slug);
        loaded = true;
      }
      frame.style.display = open ? "block" : "none";
      btn.textContent = open ? "✕" : "💬";
      btn.setAttribute("aria-label", open ? "Close chat" : "Open chat");
    }
    btn.addEventListener("click", function () { toggle(); });
    window.addEventListener("message", function (e) {
      if (e.origin === origin && e.data && e.data.type === "chatform:close") toggle(false);
    });
    wrap.appendChild(style);
    wrap.appendChild(frame);
    wrap.appendChild(btn);
    document.body.appendChild(wrap);
  }

  function start() {
    // Fetch the owner's chosen color; fall back to data-color / default if it fails.
    fetch(origin + "/api/public/forms/" + encodeURIComponent(slug))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d) init(d.primary_color || color); else console.warn("[ChatForm] Form not found or unpublished"); })
      .catch(function () { init(color); });
  }
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
})();
