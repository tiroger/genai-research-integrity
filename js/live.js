/* Thin wrapper around Firebase Realtime Database for live voting.
   Data layout:  s/{session}/owner            uid of the presenter (first writer wins)
                 s/{session}/state/round      round the audience should see
                 s/{session}/state/reveal/{r} the answer string, once revealed
                 s/{session}/votes/{r}/{uid}  one string per person per round
   If FIREBASE_CONFIG is missing or anything fails, Live.ready resolves false
   and the deck falls back to local clicks. */
(function () {
  var SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
  var db = null, uid = null, readyP = null;

  function load(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = function () { rej(new Error("load " + src)); };
      document.head.appendChild(s);
    });
  }
  function timeout(p, ms) {
    return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error("timeout")); }, ms); })]);
  }

  function init() {
    if (readyP) return readyP;
    var cfg = window.FIREBASE_CONFIG;
    if (!cfg || !cfg.databaseURL || location.protocol === "file:") return (readyP = Promise.resolve(false));
    // fetch all three SDK files in parallel; execute app first (the others depend on it)
    ["firebase-auth-compat.js", "firebase-database-compat.js"].forEach(function (f) {
      var l = document.createElement("link"); l.rel = "preload"; l.as = "script"; l.href = SDK + f; document.head.appendChild(l);
    });
    readyP = timeout(
      load(SDK + "firebase-app-compat.js")
        .then(function () { return Promise.all([load(SDK + "firebase-auth-compat.js"), load(SDK + "firebase-database-compat.js")]); })
        .then(function () {
          if (!firebase.apps.length) firebase.initializeApp(cfg);
          return firebase.auth().signInAnonymously();
        })
        .then(function (cred) { uid = cred.user.uid; db = firebase.database(); return true; }),
      15000
    ).catch(function (e) { console.warn("[live] off:", e && e.message); readyP = null; return false; });
    return readyP;
  }

  function ref(path) { return db.ref(path); }
  function clean(s) { return String(s || "").replace(/[^a-z0-9]/gi, "").slice(0, 16).toLowerCase(); }

  window.Live = {
    init: init,
    get uid() { return uid; },
    clean: clean,
    newSession: function () {
      var a = "abcdefghjkmnpqrstuvwxyz23456789", s = "";
      for (var i = 0; i < 5; i++) s += a[Math.floor(Math.random() * a.length)];
      return s;
    },
    /* presenter */
    claim: function (s) {
      var o = ref("s/" + s + "/owner");
      return o.once("value").then(function (snap) {
        if (snap.exists()) return snap.val() === uid;
        return o.set(uid).then(function () { return true; });
      }).catch(function () { return false; });
    },
    setRound: function (s, r) { return ref("s/" + s + "/state/round").set(r || null).catch(function () {}); },
    setReveal: function (s, r, answer) { return ref("s/" + s + "/state/reveal/" + r).set(answer ? String(answer) : null).catch(function () {}); },
    onVotes: function (s, r, cb) {
      var q = ref("s/" + s + "/votes/" + r);
      var h = function (snap) { cb(snap.val() || {}); };
      q.on("value", h);
      return function () { q.off("value", h); };
    },
    /* audience */
    onState: function (s, cb) {
      var q = ref("s/" + s + "/state");
      q.on("value", function (snap) { cb(snap.val() || {}); });
    },
    myVote: function (s, r) {
      return ref("s/" + s + "/votes/" + r + "/" + uid).once("value").then(function (x) { return x.val(); });
    },
    vote: function (s, r, val) {
      return ref("s/" + s + "/votes/" + r + "/" + uid).set(String(val).slice(0, 200));
    }
  };
})();
