/* Deck behaviour: charts, counters, games, live voting, lens, slider, cover animation. */
(function () {
  "use strict";
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var R = window.ROUNDS || {};

  /* ---------------- Reveal ---------------- */
  Reveal.initialize({
    width: 1920, height: 1080, margin: 0, minScale: 0.1, maxScale: 3,
    center: false, hash: true, controls: true, controlsTutorial: false, progress: true,
    slideNumber: "c/t", transition: "fade", backgroundTransition: "fade", transitionSpeed: "default",
    pdfSeparateFragments: false, plugins: [window.RevealNotes].filter(Boolean)
  });

  /* ---------------- charts ---------------- */
  var market = [[2023, 4.5], [2024, 5.4], [2025, 6.4], [2026, 7.6], [2027, 9.1], [2028, 10.9], [2029, 13.0], [2030, 15.5], [2031, 18.5], [2032, 22.0], [2033, 26.3]];
  var m = $("#market");
  if (m) {
    var ticks = [0, 5, 10, 15, 20, 25, 30], ya = "", gl = "";
    ticks.forEach(function (t) { var p = (t / 30 * 100).toFixed(2); ya += '<span style="bottom:' + p + '%">$' + t + "B</span>"; if (t) gl += '<div class="gl" style="bottom:' + p + '%"></div>'; });
    m.innerHTML = '<div class="ya">' + ya + '</div><div class="plot">' + gl + '<div class="bars">' +
      market.map(function (d) { return '<div class="bar' + (d[0] === 2026 ? " now" : "") + '" data-h="' + (d[1] / 30 * 100).toFixed(2) + '"><b>' + d[1].toFixed(1) + "</b></div>"; }).join("") +
      '</div></div><div class="xa">' + market.map(function (d) { return '<span' + (d[0] === 2026 ? ' class="now"' : "") + ">" + d[0] + "</span>"; }).join("") + "</div>";
  }

  var survey = [["More reliance on pattern recognition without understanding", 69], ["Results can entrench bias or discrimination", 58], ["Makes fraud easier", 55, 1], ["Ill-considered use leads to irreproducible research", 53], ["Only well-resourced scientists can keep up", 43], ["Expensive or energy-intensive", 26], ["Other", 3]];
  var sv = $("#survey");
  if (sv) sv.innerHTML = survey.map(function (d) {
    return '<div class="hrow' + (d[2] ? " key" : "") + '" data-w="' + d[1] + '"><div class="l">' + d[0] + '</div><div class="t"><i></i></div><div class="n">' + d[1] + "%</div></div>";
  }).join("");

  function playCharts(slide) {
    $$(".vchart .bar", slide).forEach(function (b, i) {
      b.style.transition = "none"; b.style.height = "0"; void b.offsetHeight; b.style.transition = "";
      setTimeout(function () { b.style.height = b.dataset.h + "%"; }, 150 + i * 70);
    });
    $$(".hrow", slide).forEach(function (b, i) {
      var bar = $(".t i", b); bar.style.transition = "none"; bar.style.width = "0"; void bar.offsetWidth; bar.style.transition = "";
      setTimeout(function () { bar.style.width = b.dataset.w + "%"; }, 250 + i * 120);
    });
  }

  /* tech panic: one stage lit per click */
  function panicStep(slide) {
    if (!slide || slide.id !== "panic") return;
    var n = $$(".fragment.step.visible", slide).length;
    $$(".beat", slide).forEach(function (b) { var i = +b.dataset.i; b.classList.toggle("on", i === n); b.style.opacity = (n === 0 || i <= n) ? 1 : .35; });
    $$(".pt", slide).forEach(function (p) { p.classList.toggle("on", +p.dataset.i === n); });
  }

  /* ---------------- counters ---------------- */
  function count(el) {
    var to = parseFloat(el.dataset.count), dec = parseInt(el.dataset.dec || "0", 10), pre = el.dataset.pre || "";
    var t0 = performance.now(), dur = 1300;
    function step(t) {
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = pre + (to * e).toFixed(dec);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---------------- cover: tiny diffusion model ---------------- */
  (function cover() {
    var c = $("#diffusion"); if (!c) return;
    var g = c.getContext("2d"), W = c.width, H = c.height, img = g.createImageData(W, H);
    var target = new Float32Array(W * H);
    // western-blot-like bands on the right
    var lanes = 6, x0 = 18, x1 = 84, lw = (x1 - x0) / lanes;
    var rows = [[36, 1.0], [55, 0.55], [74, 0.8]];
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var v = 0;
      if (x >= x0 && x < x1) {
        var li = Math.floor((x - x0) / lw), cx = x0 + (li + 0.5) * lw, dx = (x - cx) / (lw * 0.38);
        rows.forEach(function (r, ri) {
          var amp = r[1] * (ri === 0 ? (li < 3 ? 0.45 : 1) : 0.6 + 0.4 * Math.sin(li * 1.7 + ri));
          var dy = (y - r[0]) / 2.1;
          v += amp * Math.exp(-dx * dx * dx * dx - dy * dy);
        });
      }
      target[y * W + x] = Math.min(1, v);
    }
    var noise = new Float32Array(W * H), T0 = performance.now(), period = 9000;
    function frame(now) {
      if (!document.body.contains(c)) return;
      var ph = ((now - T0) % period) / period;          // 0..1
      var a = ph < 0.65 ? ph / 0.65 : ph < 0.85 ? 1 : 1 - (ph - 0.85) / 0.15; // denoise, hold, re-noise
      a = a * a * (3 - 2 * a);
      for (var i = 0; i < W * H; i++) {
        noise[i] = noise[i] * 0.6 + Math.random() * 0.4;
        var v = target[i] * a + noise[i] * (1 - a) * 0.55;
        var px = i % W, fade = Math.min(1, Math.max(0, (px + 2) / 22));
        v *= fade;
        img.data[i * 4] = 11 + v * (185 - 11) * .9;
        img.data[i * 4 + 1] = 31 + v * (217 - 31);
        img.data[i * 4 + 2] = 68 + v * (235 - 68);
        img.data[i * 4 + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      setTimeout(function () { requestAnimationFrame(frame); }, 60);
    }
    requestAnimationFrame(frame);
  })();

  /* ---------------- games ---------------- */
  var games = {}; // round -> state

  function renderPoll(el, def) {
    el.innerHTML = '<div class="vote"><div class="vhead"><span>Poll, pick all that apply</span><button class="vreset" data-poll-reset>reset</button></div>' +
      def.options.map(function (o) {
        return '<div class="vrow popt" data-id="' + o.id + '"><button class="vbtn" style="--c:#B9D9EB"><span class="vlabel">' + o.label + '</span></button><div class="vbar"><div class="vfill" style="--c:#B9D9EB"></div></div><span class="vcount">0</span></div>';
      }).join("") + '<div class="vtotal">Total: <b data-total>0</b></div></div>';
  }
  function renderTiles(el, def) {
    el.classList.add("spot");
    el.innerHTML = def.items.map(function (it) {
      return '<div class="tile" data-id="' + it.id + '"><img src="' + it.img + '" alt="Image ' + it.id + '"><span class="lbl">' + it.id + '</span><span class="flag">My pick</span><div class="verdict"><b></b></div><div class="meter"><i></i><span>0%</span></div></div>';
    }).join("");
  }
  function renderCols(el, def) {
    var p = {}; def.panels.forEach(function (x) { p[x.id] = x; });
    function panel(x) {
      var z = ""; for (var i = 0; i < x.n; i++) z += '<div class="z" data-p="' + x.id + '" data-i="' + i + '"><span class="pct">0%</span></div>';
      return '<div><p class="pl">' + x.label + '</p><div class="panel"><img src="' + x.img + '" alt="' + x.label + '"><div class="zones">' + z + "</div></div></div>";
    }
    el.innerHTML = '<div class="cgame"><div class="colx" style="gap:16px">' + panel(p.red) + panel(p.tum) + '</div><div class="colx" style="gap:16px">' + panel(p.plt) + panel(p.blt) + "</div></div>";
  }
  function renderAB(el, def) {
    el.innerHTML = '<div class="ab">' + def.options.map(function (o) {
      return '<div class="abopt" data-id="' + o.id + '"><div class="k"><span class="vkey">' + o.id + '</span><span class="res"></span></div><img src="' + o.img + '" alt="Option ' + o.id + '"><div class="vbar"><div class="vfill"></div></div></div>';
    }).join("") + "</div>";
  }

  function parseAnswer(type, s) {
    if (type === "columns") {
      var o = {}; (s || "").split("|").forEach(function (part) { var kv = part.split(":"); if (kv[0]) o[kv[0]] = (kv[1] || "").split(".").filter(Boolean); });
      return o;
    }
    return (s || "").split(",").filter(Boolean);
  }

  $$(".game").forEach(function (el) {
    var round = el.dataset.round, def = R[round]; if (!def) return;
    var st = games[round] = { round: round, def: def, el: el, slide: el.closest("section"), answer: el.dataset.answer || "", revealed: false, local: {}, votes: {} };
    if (def.type === "multi") renderPoll(el, def);
    if (def.type === "tiles") renderTiles(el, def);
    if (def.type === "columns") renderCols(el, def);
    if (def.type === "ab") renderAB(el, def);

    el.addEventListener("click", function (e) {
      if (def.type === "multi") {
        if (e.target.closest("[data-poll-reset]")) { st.local = {}; update(st); return; }
        var o = e.target.closest(".popt"); if (!o) return;
        var id = o.dataset.id; st.local[id] = Math.max(0, (st.local[id] || 0) + (e.shiftKey ? -1 : 1));
        update(st); return;
      }
      if (def.type === "tiles") { var t = e.target.closest(".tile"); if (t) t.classList.toggle("pick"); }
      if (def.type === "columns") { var z = e.target.closest(".z"); if (z) z.classList.toggle("pick"); }
      if (def.type === "ab") {
        var a = e.target.closest(".abopt"); if (!a) return;
        $$(".abopt", el).forEach(function (x) { x.classList.toggle("pick", x === a && !x.classList.contains("pick")); });
      }
      if (st.revealed) score(st);
    });
  });

  function tally(st) {
    // returns {n: voters, c: {key: count}}
    var c = {}, n = 0, t = st.def.type;
    Object.keys(st.votes).forEach(function (uid) {
      var v = st.votes[uid]; if (typeof v !== "string") return; n++;
      if (t === "columns") {
        var o = parseAnswer("columns", v);
        Object.keys(o).forEach(function (p) { o[p].forEach(function (i) { c[p + ":" + i] = (c[p + ":" + i] || 0) + 1; }); });
      } else v.split(",").filter(Boolean).forEach(function (k) { c[k] = (c[k] || 0) + 1; });
    });
    return { n: n, c: c };
  }

  function update(st) {
    var T = tally(st), t = st.def.type, el = st.el;
    var vc = $("[data-vcount]", st.slide);
    if (vc) vc.textContent = Live.on ? (T.n + (T.n === 1 ? " vote" : " votes")) : "";
    var pct = function (k) { return T.n ? Math.round(100 * (T.c[k] || 0) / T.n) : 0; };
    if (t === "multi") {
      var counts = {}, max = 1;
      st.def.options.forEach(function (o) { counts[o.id] = (st.local[o.id] || 0) + (T.c[o.id] || 0); max = Math.max(max, counts[o.id]); });
      var tot = 0;
      $$(".popt", el).forEach(function (row) {
        var k = row.dataset.id; $(".vcount", row).textContent = counts[k]; tot += counts[k];
        $(".vfill", row).style.width = (100 * counts[k] / max) + "%";
      });
      var tt = $("[data-total]", el); if (tt) tt.textContent = Live.on ? T.n + " people" : tot + " hands";
    }
    if (t === "tiles") $$(".tile", el).forEach(function (tile) {
      var p = pct(tile.dataset.id); $(".meter i", tile).style.width = p + "%"; $(".meter span", tile).textContent = p + "%";
    });
    if (t === "columns") $$(".z", el).forEach(function (z) { $(".pct", z).textContent = pct(z.dataset.p + ":" + z.dataset.i) + "%"; });
    if (t === "ab") $$(".abopt", el).forEach(function (o) {
      var p = pct(o.dataset.id); $(".vfill", o).style.width = p + "%";
    });
    if (st.revealed) score(st);
  }

  function score(st) {
    var t = st.def.type, el = st.el, out = $("[data-score]", st.slide); if (!out) return;
    var ans = parseAnswer(t, st.answer), T = tally(st), msg = "";
    if (t === "tiles") {
      var picks = $$(".tile.pick", el).map(function (x) { return x.dataset.id; });
      var hit = picks.filter(function (p) { return ans.indexOf(p) >= 0; }).length, fa = picks.length - hit;
      if (picks.length) msg = "Picked " + hit + " of " + ans.length + " fakes" + (fa ? ", " + fa + " false alarm" + (fa > 1 ? "s" : "") : "") + ".";
      if (T.n) {
        var all = 0; Object.keys(st.votes).forEach(function (u) {
          var v = String(st.votes[u]).split(",").filter(Boolean).sort().join(","); if (v === ans.slice().sort().join(",")) all++;
        });
        msg += (msg ? " " : "") + Math.round(100 * all / T.n) + "% of the audience got all three exactly.";
      }
    }
    if (t === "columns") {
      var hitc = 0, totc = 0, fac = 0;
      Object.keys(ans).forEach(function (p) { totc += ans[p].length; });
      $$(".z.pick", el).forEach(function (z) { if ((ans[z.dataset.p] || []).indexOf(z.dataset.i) >= 0) hitc++; else fac++; });
      if (hitc || fac) msg = "Found " + hitc + " of " + totc + (fac ? ", " + fac + " false alarm" + (fac > 1 ? "s" : "") : "") + ".";
      if (T.n) {
        var sum = 0; Object.keys(ans).forEach(function (p) { ans[p].forEach(function (i) { sum += (T.c[p + ":" + i] || 0); }); });
        msg += (msg ? " " : "") + "The audience caught " + Math.round(100 * sum / (T.n * totc)) + "% of the fakes.";
      }
    }
    if (t === "ab") {
      var pk = $(".abopt.pick", el);
      if (pk) msg = pk.dataset.id === ans[0] ? "Correct." : "Fooled you.";
      if (T.n) msg += (msg ? " " : "") + Math.round(100 * (T.c[ans[0]] || 0) / T.n) + "% of the audience picked the real one.";
    }
    out.textContent = msg;
  }

  function setRevealed(round, on) {
    var st = games[round]; if (!st) return;
    st.revealed = on;
    st.el.classList.toggle("revealed", on);
    st.slide.classList.toggle("revealed", on);
    var ans = parseAnswer(st.def.type, st.answer);
    if (st.def.type === "tiles") $$(".tile", st.el).forEach(function (t) {
      var f = ans.indexOf(t.dataset.id) >= 0;
      t.classList.toggle("fake", on && f); t.classList.toggle("real", on && !f);
      $(".verdict b", t).textContent = f ? "AI-generated" : "Real";
    });
    if (st.def.type === "columns") $$(".z", st.el).forEach(function (z) {
      z.classList.toggle("ans", on && (ans[z.dataset.p] || []).indexOf(z.dataset.i) >= 0);
    });
    if (st.def.type === "ab") $$(".abopt", st.el).forEach(function (o) {
      var real = o.dataset.id === ans[0];
      o.classList.toggle("real", on && real); o.classList.toggle("fake", on && !real);
      $(".res", o).textContent = real ? "Photographed" : "AI-generated";
    });
    if (on) score(st); else { var o = $("[data-score]", st.slide); if (o) o.textContent = ""; }
    if (Live.on && Live.host) Live.setReveal(Live.session, round, on ? st.answer : null);
  }

  $$("[data-act-reveal]").forEach(function (b) {
    b.addEventListener("click", function () {
      var r = b.closest("section").dataset.round; setRevealed(r, !games[r].revealed);
      var frag = $(".game-reveal", b.closest("section"));
      if (frag) frag.classList.toggle("visible", games[r].revealed);
    });
  });
  $$("[data-act-reset]").forEach(function (b) {
    b.addEventListener("click", function () {
      var sec = b.closest("section"), r = sec.dataset.round, st = games[r];
      $$(".pick", st.el).forEach(function (x) { x.classList.remove("pick"); });
      st.local = {}; setRevealed(r, false);
      var frag = $(".game-reveal", sec); if (frag) frag.classList.remove("visible");
      update(st);
    });
  });

  /* ---------------- live voting ---------------- */
  var Live = window.Live || { init: function () { return Promise.resolve(false); } };
  Live.on = false; Live.host = false;
  var params = new URLSearchParams(location.search);

  function voteURL(s) { return (window.SITE_URL || (location.origin + location.pathname.replace(/[^/]*$/, ""))).replace(/\/?$/, "/") + "v/#" + s; }
  function drawQR(s, live) {
    var url = voteURL(s);
    $$("[data-qr]").forEach(function (box) {
      var q = qrcode(0, "M"); q.addData(url); q.make();
      $(".qr", box).innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
      var u = $("[data-url]", box); if (u) u.textContent = url.replace(/^https?:\/\//, "");
      var lv = $(".live", box); if (lv) { lv.classList.toggle("off", live === false); lv.textContent = live === false ? "Not connected yet" : "Live · session " + s; }
    });
  }

  Live.init().then(function (ok) {
    if (!ok) {
      if (location.protocol === "file:") { $$("[data-qr]").forEach(function (b) { b.style.display = "none"; }); return; }
      // Not connected yet: still show the QR so the layout can be rehearsed.
      var s0 = Live.clean(params.get("s")) || Live.clean(localStorage.getItem("deck-session")) || (Live.newSession ? Live.newSession() : "demo");
      localStorage.setItem("deck-session", s0);
      drawQR(s0, false);
      return;
    }
    Live.on = true;
    var s = Live.clean(params.get("s")) || Live.clean(localStorage.getItem("deck-session")) || Live.newSession();
    localStorage.setItem("deck-session", s);
    Live.session = s;
    $$(".local-hint").forEach(function (h) { h.style.display = "none"; });
    return Live.claim(s).then(function (isHost) {
      Live.host = isHost;
      if (!isHost) {        // someone else owns this code: start a fresh one
        s = Live.newSession(); localStorage.setItem("deck-session", s); Live.session = s;
        return Live.claim(s).then(function (h) { Live.host = h; });
      }
    }).then(function () {
      drawQR(Live.session);
      Object.keys(games).forEach(function (r) {
        games[r].el.classList.add("has-live");
        Live.onVotes(Live.session, r, function (v) { games[r].votes = v; update(games[r]); });
      });
      syncRound(Reveal.getCurrentSlide());
    });
  });

  function syncRound(slide) {
    if (!Live.on || !Live.host) return;
    var r = slide && slide.dataset.round;
    Live.setRound(Live.session, r || null);
  }

  // keyboard: N = new live session (fresh votes)
  Reveal.addKeyBinding({ keyCode: 78, key: "N", description: "New live-voting session" }, function () {
    if (!Live.on) return;
    var s = Live.newSession(); localStorage.setItem("deck-session", s);
    location.search = "?s=" + s;
  });

  /* ---------------- slide events ---------------- */
  function onSlide(slide) {
    if (!slide) return;
    var ln = document.getElementById("lens"); if (ln) ln.style.display = "none";
    playCharts(slide);
    $$("[data-count]", slide).forEach(function (el) { if (el.dataset.on !== "fragment") count(el); });
    document.querySelector(".reveal-viewport").classList.toggle("nobrand", slide.classList.contains("cover") || slide.classList.contains("act") || /nobrand/.test(slide.dataset.state || ""));
    panicStep(slide);
    syncRound(slide);
  }
  Reveal.on("ready", function (e) { onSlide(e.currentSlide); });
  Reveal.on("slidechanged", function (e) { onSlide(e.currentSlide); });
  Reveal.on("fragmentshown", function (e) {
    var f = e.fragment; panicStep(Reveal.getCurrentSlide());
    if (f.classList.contains("game-reveal")) setRevealed(f.dataset.round, true);
    $$("[data-count][data-on=fragment]", f).forEach(count);
    if (f.matches && f.matches("[data-count][data-on=fragment]")) count(f);
  });
  Reveal.on("fragmenthidden", function (e) {
    panicStep(Reveal.getCurrentSlide());
    if (e.fragment.classList.contains("game-reveal")) setRevealed(e.fragment.dataset.round, false);
  });

  /* ---------------- magnifier lens ---------------- */
  var lens = $("#lens"), Z = 2.6;
  document.addEventListener("mousemove", function (e) {
    var img = e.target.closest && e.target.closest(".tile img, .panel img");
    if (!img && e.target.closest) { var z = e.target.closest(".tile, .panel"); if (z) img = $("img", z); }
    if (!img) { lens.style.display = "none"; return; }
    var r = img.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (x < 0 || y < 0 || x > r.width || y > r.height) { lens.style.display = "none"; return; }
    lens.style.display = "block";
    lens.style.left = (e.clientX - 130) + "px"; lens.style.top = (e.clientY - 130) + "px";
    lens.style.backgroundImage = "url('" + img.currentSrc + "')";
    lens.style.backgroundSize = (r.width * Z) + "px " + (r.height * Z) + "px";
    lens.style.backgroundPosition = (130 - x * Z) + "px " + (130 - y * Z) + "px";
  });

  /* ---------------- videos ---------------- */
  $$("video").forEach(function (v) {
    var box = v.closest(".vidframe");
    v.addEventListener("play", function () { box && box.classList.add("playing"); });
    v.addEventListener("pause", function () { box && box.classList.remove("playing"); });
    v.addEventListener("error", function () {          // no video file yet: show the still frame
      if (!box) return; box.classList.add("novid");
      var img = document.createElement("img"); img.src = v.getAttribute("poster"); img.alt = "";
      img.style.cssText = "width:100%;border-radius:8px;display:block"; v.replaceWith(img);
    }, true);
  });
  Reveal.on("slidechanged", function (e) {
    if (e.previousSlide) $$("video", e.previousSlide).forEach(function (v) { v.pause(); });
  });

  /* ---------------- hotspots ---------------- */
  $$(".hot").forEach(function (h) {
    h.addEventListener("click", function (e) { e.stopPropagation(); h.classList.toggle("open"); });
  });

  /* ---------------- compare slider ---------------- */
  $$(".cmp").forEach(function (c) {
    var top = $(".top", c), hd = $(".handle", c), drag = false;
    function set(clientX) {
      var r = c.getBoundingClientRect(), p = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      top.style.clipPath = "inset(0 0 0 " + (p * 100) + "%)"; hd.style.left = (p * 100) + "%";
    }
    c.addEventListener("pointerdown", function (e) { drag = true; c.setPointerCapture(e.pointerId); set(e.clientX); });
    c.addEventListener("pointermove", function (e) { if (drag) set(e.clientX); });
    c.addEventListener("pointerup", function () { drag = false; });
  });
})();
