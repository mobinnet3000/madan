(function () {
  "use strict";

  function getCookie(name) {
    var m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function build(el) {
    var data = el.querySelector(".fb-data");
    if (!data) return;
    var variables = [];
    try {
      variables = JSON.parse(data.getAttribute("data-vars") || "[]");
    } catch (e) {
      variables = [];
    }
    var url = data.getAttribute("data-url") || "";
    var lineId = data.getAttribute("data-line") || "";
    var textarea = el.querySelector(".formula-source");
    var result = el.querySelector(".fb-result");
    var debounce = null;

    function setStatus(text, cls) {
      if (!result) return;
      result.textContent = text;
      result.className = "fb-result" + (cls ? " " + cls : "");
    }

    function insert(text) {
      if (!textarea) return;
      var s = textarea.selectionStart || textarea.value.length;
      var e = textarea.selectionEnd || textarea.value.length;
      textarea.value = textarea.value.slice(0, s) + text + textarea.value.slice(e);
      textarea.focus();
      var pos = s + text.length;
      try {
        textarea.setSelectionRange(pos, pos);
      } catch (err) {
        /* ignore */
      }
      validate(true);
    }

    function doValidate() {
      var expr = textarea && textarea.value ? textarea.value.trim() : "";
      if (!url) return;
      if (expr === "") {
        setStatus("فرمول خالی است — با کلیک روی متغیرها بسازید یا مستقیم بنویسید", "warn");
        return;
      }
      setStatus("در حال بررسی...", "checking");
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
        body: JSON.stringify({ line_id: lineId, expression: textarea.value }),
      })
        .then(function (r) {
          return r.json().then(function (j) {
            return { ok: r.ok && j.ok, errors: j.errors || [] };
          });
        })
        .then(function (j) {
          if (j.ok) {
            setStatus("\u2713 فرمول معتبر است", "ok");
          } else if (j.errors.length === 0) {
            setStatus("خطا در ارتباط با سرور", "error");
          } else {
            setStatus("\u2717 " + j.errors.join(" | "), "error");
          }
        })
        .catch(function () {
          setStatus("خطا در ارتباط با سرور", "error");
        });
    }

    function validate(instant) {
      if (!url || !textarea) return;
      if (instant) {
        if (debounce) clearTimeout(debounce);
        doValidate();
        return;
      }
      if (debounce) clearTimeout(debounce);
      var expr = textarea.value.trim();
      if (expr === "") {
        setStatus("فرمول خالی است", "warn");
        return;
      }
      setStatus("در حال بررسی...", "checking");
      debounce = setTimeout(doValidate, 600);
    }

    // ۱) لیست کامل و قابل کلیک متغیرها (کنار فرمول)
    var chips = el.querySelector(".fb-chips");
    if (chips) {
      var groups = {};
      variables.forEach(function (v) {
        (groups[v.group] = groups[v.group] || []).push(v);
      });
      var groupNames = Object.keys(groups);
      if (groupNames.length === 0) {
        var empty = document.createElement("div");
        empty.className = "fb-empty";
        empty.textContent = "ورودی/متغیری برای این خط تعریف نشده است.";
        chips.appendChild(empty);
      }
      groupNames.forEach(function (g) {
        var head = document.createElement("div");
        head.className = "fb-chips-group";
        head.textContent = g;
        chips.appendChild(head);
        groups[g].forEach(function (v) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "fb-chip";
          b.textContent = v.label;
          b.title = v.var + "  (برای افزودن کلیک کنید)";
          var varName = v.var;
          b.addEventListener("click", function () {
            insert(varName);
          });
          chips.appendChild(b);
        });
      });
    }

    // ۲) عملگرها
    var opsContainer = el.querySelector(".fb-ops");
    if (opsContainer) {
      ["+", "-", "*", "/", "^", "%", "(", ")"].forEach(function (op) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = op;
        b.className = "fb-btn fb-op";
        b.addEventListener("click", function () {
          insert(op);
        });
        opsContainer.appendChild(b);
      });
    }

    // ۳) توابع
    var fnsContainer = el.querySelector(".fb-fns");
    if (fnsContainer) {
      ["abs", "sqrt", "max", "min", "round", "if", "pow", "log"].forEach(function (f) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = f;
        b.className = "fb-btn fb-fn";
        b.addEventListener("click", function () {
          insert(f + "(");
        });
        fnsContainer.appendChild(b);
      });
    }

    // ۴) عدد
    var numBtn = el.querySelector(".fb-add-num");
    var numInp = el.querySelector(".fb-num");
    if (numBtn && numInp) {
      numBtn.addEventListener("click", function () {
        if (numInp.value !== "") insert(numInp.value);
      });
    }

    // ۵) اعتبارسنجی: دکمه + زنده (موقع تایپ)
    var checkBtn = el.querySelector(".fb-btn-validate");
    if (checkBtn) {
      checkBtn.addEventListener("click", function () {
        validate(true);
      });
    }
    if (textarea) {
      textarea.addEventListener("input", function () {
        validate(false);
      });
      textarea.addEventListener("blur", function () {
        validate(true);
      });
      // اعتبارسنجی اولیه (فرمول موجود)
      validate(false);
    }
  }

  function init() {
    var els = document.querySelectorAll(".fb-layout");
    Array.prototype.forEach.call(els, build);
  }

  if (document.readyState !== "loading") {
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();