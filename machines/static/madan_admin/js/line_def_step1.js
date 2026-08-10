(function () {
  "use strict";

  function getCookie(name) {
    var m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildList(schema) {
    var out = "";
    function section(title, items) {
      if (!items || !items.length) return "";
      return (
        '<div class="fb-chips-group">' +
        esc(title) +
        "</div>" +
        items
          .map(function (it) {
            return (
              '<span class="fb-chip-static" data-var="' +
              esc(it.var) +
              '" title="' +
              esc(it.var) +
              '">' +
              esc(it.label) +
              "</span>"
            );
          })
          .join("")
      );
    }
    (schema.positions || []).forEach(function (p) {
      out += section(
        p.name + (p.definition ? " — " + p.definition.name : ""),
        (p.inputs || []).map(function (i) {
          return {
            var: p.key + "." + i.key,
            label: i.name + (i.unit ? " (" + i.unit + ")" : ""),
          };
        })
      );
    });
    out += section(
      "ورودی‌های اضافه",
      (schema.additional_inputs || []).map(function (a) {
        return { var: a.key, label: a.name + (a.unit ? " (" + a.unit + ")" : "") };
      })
    );
    return (
      out ||
      '<span class="fb-empty">برای این خط موقعیت آنالیز/ورودیای ثبت نشده است؛ ' +
        "ابتدا جایگاههای آنالیز و نوع آنالیزشان را برای این خط تعریف کنید.</span>"
    );
  }

  function load(el, sel) {
    var body = el.querySelector(".fb-preview-body");
    if (!body) return;
    if (!sel.value) {
      body.innerHTML =
        '<span class="fb-empty">با انتخاب خط تولید، متغیرها اینجا نمایش داده می‌شوند.</span>';
      return;
    }
    body.innerHTML = '<span class="fb-empty">در حال بارگذاری...</span>';
    fetch("/api/production-lines/" + sel.value + "/analysis-definition/", {
      headers: {
        "X-CSRFToken": getCookie("csrftoken"),
        Accept: "application/json",
      },
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, j: j };
        });
      })
      .then(function (res) {
        if (!res.ok) {
          var msg = (res.j && res.j.errors && res.j.errors.detail) || res.j.detail;
          body.innerHTML =
            '<span class="fb-empty" style="color:#dc2626">' +
            esc(msg || "خطا در دریافت متغیرها") +
            "</span>";
          return;
        }
        body.innerHTML = buildList(res.j);
      })
      .catch(function () {
        body.innerHTML =
          '<span class="fb-empty" style="color:#dc2626">خطا در بارگذاری متغیرها (اتصال به API ناموفق)</span>';
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var sel = document.getElementById("id_line");
    var el = document.getElementById("line-vars-preview");
    if (!sel || !el) return;
    // بدنه‌ی پیش‌نمایش را ساختار می‌دهیم (عنوان + محتوای پویا)
    var title = el.querySelector(".fb-vars-title");
    var body = document.createElement("div");
    body.className = "fb-preview-body";
    var header = title ? title.outerHTML : "";
    var varsTitle = document.createElement("div");
    varsTitle.className = "fb-vars-title";
    varsTitle.textContent = "ورودی‌های موجود (موقعیت‌های آنالیز خط + ورودی‌ها)";
    el.innerHTML = "";
    el.appendChild(varsTitle);
    el.appendChild(body);
    load(el, sel);
    sel.addEventListener("change", function () {
      load(el, sel);
    });
  });
})();