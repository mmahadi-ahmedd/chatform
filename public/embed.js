/*!
 * ChatForm embed script
 *   Floating:  <script src="https://YOUR-APP/embed.js" data-form="FORM_SLUG" async></script>
 *   Inline:    <script src="https://YOUR-APP/embed.js" data-form="FORM_SLUG" data-mode="inline" async></script>
 * Options: data-position="left|right"  data-color="#hex" (fallback)  data-target="#css-selector" (inline)
 *          data-height="600px" (inline)  data-open="true"  data-teaser="false"
 */
(function () {
  var script = document.currentScript;
  if (!script) {
    var all = document.querySelectorAll("script[data-form]");
    script = all[all.length - 1];
  }
  if (!script) return;
  var slug = script.getAttribute("data-form");
  if (!slug) return console.error("[ChatForm] Missing data-form attribute");
  var key = "__chatform_" + slug;
  if (window[key]) return;
  window[key] = true;

  var origin = new URL(script.src, location.href).origin;
  var mode = script.getAttribute("data-mode") === "inline" ? "inline" : "floating";
  var fallbackColor = script.getAttribute("data-color") || "#4f46e5";
  var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var widgetUrl = origin + "/widget/" + encodeURIComponent(slug);

  function el(tag, css, attrs) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    for (var k in attrs || {}) e.setAttribute(k, attrs[k]);
    return e;
  }
  function avatarNode(avatar, size) {
    var box = el("span", "display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:50%;width:" + size + "px;height:" + size + "px;font-size:" + size * 0.55 + "px;line-height:1", { "aria-hidden": "true" });
    if (/^https:\/\//.test(avatar || "")) {
      var img = el("img", "width:100%;height:100%;object-fit:cover", { alt: "", referrerpolicy: "no-referrer" });
      img.src = avatar;
      box.appendChild(img);
    } else box.textContent = avatar || "💬";
    return box;
  }

  /* ---------- inline mode ---------- */
  function mountInline() {
    var frame = el("iframe", "width:100%;height:" + (script.getAttribute("data-height") || "600px") + ";border:1px solid #e5e7eb;border-radius:12px;background:#fff;display:block", { title: "Chat", src: widgetUrl + "?inline=1", loading: "lazy" });
    var target = script.getAttribute("data-target") && document.querySelector(script.getAttribute("data-target"));
    if (target) target.appendChild(frame);
    else script.parentNode.insertBefore(frame, script.nextSibling);
  }

  /* ---------- floating mode ---------- */
  function mountFloating(cfg) {
    var color = cfg.primary_color || fallbackColor;
    var side = script.getAttribute("data-position") || cfg.position || "right";
    side = side === "left" ? "left" : "right";
    var teaserKey = "chatform_teaser_" + slug;
    var open = false, loaded = false;

    var css =
      "#cf-btn{position:fixed;bottom:20px;" + side + ":20px;width:60px;height:60px;border-radius:50%;border:0;padding:0;cursor:pointer;color:#fff;background:" + color + ";box-shadow:0 6px 20px rgba(0,0,0,.28);z-index:2147483646;display:flex;align-items:center;justify-content:center;font:inherit}" +
      "#cf-btn:focus-visible{outline:3px solid #fff;box-shadow:0 0 0 6px " + color + "}" +
      "#cf-frame{position:fixed;bottom:92px;" + side + ":20px;width:380px;height:600px;max-height:calc(100vh - 112px);border:0;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.3);z-index:2147483647;background:#fff;visibility:hidden;opacity:0;pointer-events:none}" +
      "#cf-teaser{position:fixed;bottom:90px;" + side + ":20px;max-width:260px;background:#fff;color:#111827;font:14px/1.4 system-ui,sans-serif;padding:12px 32px 12px 14px;border-radius:14px;box-shadow:0 6px 24px rgba(0,0,0,.2);z-index:2147483645;cursor:pointer;display:none}" +
      "#cf-teaser button{position:absolute;top:2px;right:4px;border:0;background:none;font-size:16px;color:#6b7280;cursor:pointer;padding:4px}" +
      "@media (max-width:480px){#cf-frame{inset:0;width:100%;height:100dvh;max-height:none;border-radius:0}#cf-btn.cf-open{display:none}#cf-teaser{max-width:calc(100vw - 100px)}}";
    if (!reduceMotion) {
      css +=
        "#cf-frame{transition:opacity .2s ease,transform .2s ease,visibility .2s;transform:translateY(12px) scale(.97);transform-origin:bottom " + side + "}" +
        "#cf-frame.cf-show{transform:none}" +
        "#cf-btn{animation:cf-pop .4s ease-out both}#cf-btn:hover{transform:scale(1.07);transition:transform .15s}" +
        "#cf-btn.cf-pulse::after{content:'';position:absolute;inset:0;border-radius:50%;box-shadow:0 0 0 0 " + color + ";animation:cf-pulse 1.8s ease-out 3}" +
        "@keyframes cf-pop{from{transform:scale(.4);opacity:0}to{transform:none;opacity:1}}" +
        "@keyframes cf-pulse{to{box-shadow:0 0 0 18px transparent}}";
    }
    css += "#cf-frame.cf-show{visibility:visible;opacity:1;pointer-events:auto}";

    var wrap = el("div", "", { id: "chatform-widget" });
    var style = document.createElement("style");
    style.textContent = css;
    var frame = el("iframe", "", { id: "cf-frame", title: "Chat" });
    var btn = el("button", "", { id: "cf-btn", type: "button", "aria-label": "Open chat", "aria-expanded": "false" });
    btn.className = "cf-pulse";
    var icon = avatarNode(cfg.avatar, 34);
    btn.appendChild(icon);

    var teaser = null;
    function hideTeaser(remember) {
      if (teaser) teaser.style.display = "none";
      if (remember) try { sessionStorage.setItem(teaserKey, "1"); } catch (e) {}
    }
    if (script.getAttribute("data-teaser") !== "false" && cfg.welcome_message) {
      var seen = false;
      try { seen = !!sessionStorage.getItem(teaserKey); } catch (e) {}
      if (!seen) {
        teaser = el("div", "", { id: "cf-teaser", role: "status" });
        teaser.textContent = cfg.welcome_message;
        var x = el("button", "", { type: "button", "aria-label": "Dismiss" });
        x.textContent = "×";
        x.addEventListener("click", function (e) { e.stopPropagation(); hideTeaser(true); });
        teaser.appendChild(x);
        teaser.addEventListener("click", function () { toggle(true); });
        setTimeout(function () { if (!open && teaser) teaser.style.display = "block"; }, 2500);
      }
    }

    function toggle(show) {
      open = typeof show === "boolean" ? show : !open;
      if (open && !loaded) { frame.src = widgetUrl; loaded = true; }
      frame.classList.toggle("cf-show", open);
      btn.classList.toggle("cf-open", open);
      btn.classList.remove("cf-pulse");
      btn.setAttribute("aria-expanded", String(open));
      btn.setAttribute("aria-label", open ? "Close chat" : "Open chat");
      if (open) hideTeaser(true);
      else btn.focus({ preventScroll: true });
    }
    btn.addEventListener("click", function () { toggle(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && open) toggle(false); });
    window.addEventListener("message", function (e) {
      if (e.source === frame.contentWindow && e.data && e.data.type === "chatform:close") toggle(false);
    });

    wrap.appendChild(style);
    wrap.appendChild(frame);
    if (teaser) wrap.appendChild(teaser);
    wrap.appendChild(btn);
    document.body.appendChild(wrap);
    if (script.getAttribute("data-open") === "true") toggle(true);
  }

  function start() {
    if (mode === "inline") return mountInline();
    fetch(origin + "/api/public/forms/" + encodeURIComponent(slug))
      .then(function (r) {
        if (r.status === 404) { console.warn("[ChatForm] Form not found or not published"); return null; }
        return r.ok ? r.json() : {};
      })
      .then(function (cfg) { if (cfg) mountFloating(cfg); })
      .catch(function () { mountFloating({}); });
  }
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
})();
