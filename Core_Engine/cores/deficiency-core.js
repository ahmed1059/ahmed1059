/* deficiency-core — عقل النواقص (وقائي).
 * يفحص البيانات قبل الطباعة ويعيد تحذيرات. لا يمنع الطباعة.
 * لا يخترع أسماء أو أعداد. الفراغ نقص يُذكر.
 */
(function (root) {
  "use strict";

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function asList(value) {
    return Array.isArray(value) ? value : [];
  }

  function hasSignature(value) {
    var raw = text(value);
    return !!(raw && raw !== "null");
  }

  function hasPhoto(item) {
    if (!item) {
      return false;
    }
    if (typeof item === "string") {
      return !!text(item);
    }
    return !!(item.dataUrl || item.url || item.src);
  }

  function studentClass(row) {
    if (!row) {
      return { grade: "", section: "" };
    }
    if (Array.isArray(row)) {
      return { grade: text(row[1]), section: text(row[2]) };
    }
    return {
      grade: text(row.grade || row.class_name || row.صف),
      section: text(row.section || row.فصل)
    };
  }

  function staffRole(row, roleIndex) {
    if (!row) {
      return "";
    }
    if (Array.isArray(row)) {
      return text(row[roleIndex >= 0 ? roleIndex : 2]);
    }
    return text(row.role || row.الصفة);
  }

  function checkStudents(data) {
    var warnings = [];
    var rows = asList(data.students).length ? asList(data.students) : asList(data.rows);
    var missing = 0;
    rows.forEach(function (row) {
      var place = studentClass(row);
      if (!place.grade || !place.section) {
        missing += 1;
      }
    });
    if (missing) {
      warnings.push("طلاب بلا صف أو فصل (" + missing + ")");
    }
    return warnings;
  }

  function checkProgramCard(data) {
    var warnings = [];
    var images = asList(data.images).concat(asList(data.photos)).concat(asList(data.evidenceItems));
    var photoCount = 0;
    images.forEach(function (item) {
      if (hasPhoto(item)) {
        photoCount += 1;
      }
    });
    if (!photoCount) {
      warnings.push("لا صور شواهد");
    }
    var columns = asList(data.signoffColumns);
    var executor = columns[0] || {};
    var signed = hasSignature(executor.signature)
      || hasSignature(data.executor_signature)
      || hasSignature(data.record && data.record.executor_signature);
    if (!signed) {
      warnings.push("لا توقيع لصاحب البرنامج أو المنفذ");
    }
    return warnings;
  }

  function checkStaff(data) {
    var warnings = [];
    var columns = asList(data.columns);
    var roleIndex = columns.indexOf("الصفة");
    if (roleIndex < 0) {
      roleIndex = 2;
    }
    var rows = asList(data.people).length ? asList(data.people) : asList(data.rows);
    var missing = 0;
    rows.forEach(function (row) {
      if (!staffRole(row, roleIndex)) {
        missing += 1;
      }
    });
    if (missing) {
      warnings.push("منسوبون بلا صفة (" + missing + ")");
    }
    return warnings;
  }

  var DeficiencyCore = {
    /**
     * @param {string} docType students-list | program-card | staff-list
     * @param {object} data
     * @returns {string[]}
     */
    check: function (docType, data) {
      data = data || {};
      var kind = text(docType);
      if (kind === "students-list" || kind === "students" || kind === "كشف طلاب") {
        return checkStudents(data);
      }
      if (kind === "program-card" || kind === "card" || kind === "بطاقة برنامج") {
        return checkProgramCard(data);
      }
      if (kind === "staff-list" || kind === "staff" || kind === "كشف منسوبين") {
        return checkStaff(data);
      }
      return [];
    }
  };

  root.DeficiencyCore = DeficiencyCore;
}(typeof window !== "undefined" ? window : this));
