/* تقنيع رقم الهوية / السجل المدني — آخر ٣ أرقام فقط */
(function (root) {
  "use strict";

  var EASTERN = "٠١٢٣٤٥٦٧٨٩";

  function digitsOnly(value) {
    return String(value == null ? "" : value).replace(/\D/g, "");
  }

  function toEastern(value) {
    return String(value == null ? "" : value).replace(/[0-9]/g, function (d) {
      return EASTERN.charAt(Number(d));
    });
  }

  function maskNationalId(value, visibleTail) {
    var digits = digitsOnly(value);
    var tail = Math.max(1, Number(visibleTail || 3));
    if (!digits) {
      return "";
    }
    if (digits.length <= tail) {
      return toEastern(digits);
    }
    return "*".repeat(Math.min(digits.length - tail, 10)) + toEastern(digits.slice(-tail));
  }

  function armNationalIdField(input, options) {
    options = options || {};
    if (!input || input.getAttribute("data-nid-armed") === "1") {
      return;
    }
    input.setAttribute("data-nid-armed", "1");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocorrect", "off");
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("spellcheck", "false");
    input.setAttribute("name", options.name || "national-id-masked");
    input.setAttribute("inputmode", "numeric");
    input.setAttribute("data-lpignore", "true");
    input.setAttribute("data-1p-ignore", "true");

    var revealed = false;
    var store = document.createElement("input");
    store.type = "hidden";
    store.id = (input.id || "national-id") + "-real";
    store.name = options.realName || "national_id_real";
    input.parentNode.insertBefore(store, input.nextSibling);

    var eye = document.createElement("button");
    eye.type = "button";
    eye.className = "nid-eye-btn";
    eye.setAttribute("aria-label", "إظهار أو إخفاء رقم الهوية");
    eye.textContent = "👁";
    eye.title = "إظهار/إخفاء لصاحبه فقط";
    if (input.parentNode) {
      var wrap = document.createElement("div");
      wrap.className = "nid-mask-wrap";
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
      wrap.appendChild(eye);
    }

    function paint() {
      var raw = store.value || digitsOnly(input.value);
      store.value = raw;
      input.value = revealed ? toEastern(raw) : maskNationalId(raw, options.tail || 3);
      input.setAttribute("data-nid-raw-len", String(raw.length));
    }

    input.addEventListener("focus", function () {
      // أثناء التحرير نعرض خانات الإدخال كقرص مع الإبقاء على القيمة الحقيقية في المخزن
      revealed = false;
      input.value = store.value;
      input.style.setProperty("-webkit-text-security", "disc");
      input.style.setProperty("text-security", "disc");
    });

    input.addEventListener("blur", function () {
      input.style.removeProperty("-webkit-text-security");
      input.style.removeProperty("text-security");
      store.value = digitsOnly(input.value || store.value);
      revealed = false;
      paint();
    });

    input.addEventListener("input", function () {
      var typed = digitsOnly(input.value);
      // إذا كان الحقل يعرض قناعاً ثم بدأ المستخدم الكتابة من الصفر
      if (input.style.getPropertyValue("-webkit-text-security") === "disc" || input.style.getPropertyValue("text-security") === "disc") {
        store.value = typed;
      } else if (/^\*+/.test(input.value)) {
        // تجاهل تحرير القناع مباشرة
        paint();
        return;
      } else {
        store.value = typed;
      }
    });

    eye.addEventListener("click", function () {
      revealed = !revealed;
      input.style.removeProperty("-webkit-text-security");
      input.style.removeProperty("text-security");
      if (revealed) {
        input.value = toEastern(store.value);
      } else {
        paint();
      }
      eye.classList.toggle("is-on", revealed);
    });

    input._nidGet = function () {
      return digitsOnly(store.value || input.value);
    };
    input._nidSet = function (value) {
      store.value = digitsOnly(value);
      revealed = false;
      input.style.removeProperty("-webkit-text-security");
      input.style.removeProperty("text-security");
      paint();
    };

    if (input.value) {
      store.value = digitsOnly(input.value);
      paint();
    }
  }

  root.NationalIdMask = {
    digitsOnly: digitsOnly,
    toEastern: toEastern,
    mask: maskNationalId,
    arm: armNationalIdField
  };
})(window);
