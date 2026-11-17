/* م1-موسّع + م3 · قرار 143/145 · RolePlanPack — 11 دوراً + task_goal_links */
(function (global) {
  "use strict";

  var REGISTER_FALLBACK = [
    { id: 1, label_ar: "سجل القيادة والتحسين المستمر" },
    { id: 2, label_ar: "سجل التطوير المهني" },
    { id: 3, label_ar: "سجل المناهج والتقويم" },
    { id: 4, label_ar: "سجل الانضباط" },
    { id: 5, label_ar: "سجل الأنشطة والرعاية" },
    { id: 6, label_ar: "سجل البيئة والموارد" }
  ];

  function plain(v) {
    return String(v == null ? "" : v).trim();
  }

  function fetchJson(url) {
    return fetch(url, { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status + " · " + url);
      return res.json();
    });
  }

  function softFetch(url) {
    return fetchJson(url).then(
      function (data) {
        return { ok: true, data: data };
      },
      function (err) {
        return { ok: false, error: err, data: null };
      }
    );
  }

  function roleOwnsProgram(roleId, program) {
    if (!program || !roleId) return false;
    var roles = program.owner_roles;
    if (Array.isArray(roles) && roles.length) {
      return roles.indexOf(roleId) !== -1;
    }
    return plain(program.owner_role) === roleId;
  }

  function normalizeProgram(raw) {
    if (!raw || typeof raw !== "object") return null;
    var id = plain(raw.id || raw.template_key || raw.program_id);
    var name = plain(raw.name || raw.program_name || raw.label);
    if (!id && !name) return null;
    var ownerRoles = Array.isArray(raw.owner_roles) ? raw.owner_roles.slice() : [];
    var ownerRole = plain(raw.owner_role);
    if (!ownerRoles.length && ownerRole) ownerRoles = [ownerRole];
    return {
      id: id,
      name: name,
      label: plain(raw.label) || name,
      kind: plain(raw.kind) || "برنامج",
      goal_ref: plain(raw.goal_ref),
      owner_role: ownerRole || (ownerRoles[0] || ""),
      owner_roles: ownerRoles,
      success_indicator: plain(raw.success_indicator || raw.kpi_description),
      domain: plain(raw.domain),
      duration: plain(raw.duration),
      target_audience: plain(raw.target_audience),
      register_id: raw.register_id != null ? raw.register_id : "",
      status: plain(raw.status) || "معتمد",
      seasonal: !!raw.seasonal,
      batch: plain(raw.batch),
      duplicate_of: plain(raw.duplicate_of),
      duplicate_reason: plain(raw.duplicate_reason)
    };
  }

  function normalizeTask(raw, linkMap, roleId) {
    if (!raw || typeof raw !== "object") return null;
    var code = plain(raw.task_code || raw.code);
    var title = plain(raw.title);
    if (!code && !title) return null;
    var key = roleId + "::" + code;
    var link = (linkMap && linkMap[key]) || null;
    var goalFromLink = link ? plain(link.goal_id) : "";
    var goal = plain(raw.goal_id) || goalFromLink || "unmapped";
    if (goal === "") goal = "unmapped";
    return {
      task_code: code,
      title: title,
      week_target: raw.week_target != null ? raw.week_target : "",
      execution_method: plain(raw.execution_method),
      execution_time: plain(raw.execution_time),
      evidence: plain(raw.evidence),
      category: plain(raw.category),
      goal_id: goal,
      goal_status: link ? plain(link.status) : goal === "unmapped" ? "unmapped" : "mapped",
      goal_source: link ? plain(link.source) : ""
    };
  }

  function indexGoalLinks(linksDoc) {
    var map = {};
    var list = (linksDoc && linksDoc.links) || [];
    list.forEach(function (row) {
      if (!row) return;
      var role = plain(row.role);
      var code = plain(row.task_code);
      if (!role || !code) return;
      map[role + "::" + code] = row;
    });
    return map;
  }

  function findRole(rolesDoc, roleId) {
    var list = (rolesDoc && rolesDoc.roles) || [];
    for (var i = 0; i < list.length; i++) {
      if (plain(list[i].id) === roleId) return list[i];
    }
    return null;
  }

  function filterIndicators(all, codes) {
    var want = {};
    (codes || []).forEach(function (c) {
      want[plain(c)] = true;
    });
    return (all || []).filter(function (ind) {
      return want[plain(ind.code)];
    });
  }

  function mapRegisters(role, registersDoc) {
    var catalog = (registersDoc && registersDoc.length ? registersDoc : null) ||
      (role && role._registersCatalog) ||
      REGISTER_FALLBACK;
    var ids = (role && role.register_ids) || [];
    return ids.map(function (id) {
      var n = Number(id);
      for (var i = 0; i < catalog.length; i++) {
        var row = catalog[i];
        if (Number(row.id) === n) {
          return { id: n, label_ar: plain(row.label_ar || row.label) };
        }
      }
      return { id: n, label_ar: "سجل " + n };
    });
  }

  function buildGoals(role, planGoals) {
    var refs = (role && role.goal_refs) || [];
    var byId = {};
    (planGoals || []).forEach(function (g) {
      byId[plain(g.id)] = plain(g.text || g.label || g.title);
    });
    return refs.map(function (id) {
      return { id: id, text: byId[id] || "" };
    });
  }

  /**
   * يبني حزمة دور واحد من الطبقات الموجودة + روابط م3 إن وُجدت.
   */
  function buildPack(roleId, sources) {
    var rolesDoc = sources.rolesDoc || {};
    var role = findRole(rolesDoc, roleId);
    if (!role) {
      return {
        ok: false,
        error: "دور غير مشمول في خطتي: " + roleId,
        role_id: roleId
      };
    }
    role._registersCatalog = rolesDoc.registers || REGISTER_FALLBACK;

    var programs = (sources.programs || [])
      .map(normalizeProgram)
      .filter(Boolean)
      .filter(function (p) {
        return roleOwnsProgram(roleId, p);
      });

    var linkMap = indexGoalLinks(sources.goalLinksDoc);
    var tasks = (sources.tasks || [])
      .map(function (raw) {
        return normalizeTask(raw, linkMap, roleId);
      })
      .filter(Boolean);

    var mapped = 0;
    var unmapped = 0;
    tasks.forEach(function (t) {
      if (t.goal_id && t.goal_id !== "unmapped") mapped += 1;
      else unmapped += 1;
    });

    return {
      ok: true,
      role_id: roleId,
      role_label: plain(role.label_ar),
      task_bank_file: plain(role.task_bank_file),
      goals: buildGoals(role, sources.planGoals),
      programs: programs,
      tasks: tasks,
      task_goal_summary: { mapped: mapped, unmapped: unmapped, total: tasks.length },
      teacher_programs: (sources.goalLinksDoc && sources.goalLinksDoc.meta
        ? sources.goalLinksDoc.meta.teacher_programs
        : null),
      indicators: filterIndicators(sources.indicators || [], role.indicator_codes),
      registers: mapRegisters(role, rolesDoc.registers),
      templates: (role.templates || []).map(function (t) {
        return {
          id: plain(t.id),
          label_ar: plain(t.label_ar),
          href: plain(t.href)
        };
      }),
      knowledge_candidates: (sources.knowledgeItems || [])
        .filter(function (k) {
          return plain(k.owner_role) === roleId && plain(k.status) !== "approved";
        })
        .map(function (k) {
          return {
            archive_ref: k.archive_ref,
            title: plain(k.title || k.name),
            status: plain(k.status),
            goal_ref: plain(k.goal_ref),
            owner_role: plain(k.owner_role),
            duplicate_of: plain(k.duplicate_of),
            duplicate_reason: plain(k.duplicate_reason),
            linked_core_id: plain(k.linked_core_id)
          };
        }),
      pack_note: plain(role.pack_note),
      meta: {
        programs_source: sources.programsSource || "",
        tasks_source: sources.tasksSource || "",
        links_source: sources.linksSource || "",
        knowledge_source: sources.knowledgeSource || "",
        wave: "م4",
        decision: 147,
        task_goal_links: true
      }
    };
  }

  function loadSources(opts) {
    opts = opts || {};
    var rolesUrl = opts.rolesUrl || "roles.json";
    var programsUrl = opts.programsUrl || "../_shared/programs.json";
    var indicatorsUrl = opts.indicatorsUrl || "../_shared/indicators.json";
    var linksUrl = opts.linksUrl || "task_goal_links.json";
    var knowledgeUrl = opts.knowledgeUrl || "../_shared/programs_knowledge.json";
    var roleId = plain(opts.roleId);

    return softFetch(rolesUrl).then(function (rolesRes) {
      if (!rolesRes.ok) throw rolesRes.error || new Error("roles.json");
      var rolesDoc = rolesRes.data;
      var role = findRole(rolesDoc, roleId);

      var programsApi = softFetch("/api/programs");
      var programsFile = softFetch(programsUrl);
      var indicatorsFile = softFetch(indicatorsUrl);
      var linksFile = softFetch(linksUrl);
      var knowledgeFile = softFetch(knowledgeUrl);
      var tasksApi = roleId
        ? softFetch("/api/operational-plan/tasks?role=" + encodeURIComponent(roleId))
        : Promise.resolve({ ok: false, data: null });

      return Promise.all([
        programsApi,
        programsFile,
        indicatorsFile,
        linksFile,
        knowledgeFile,
        tasksApi
      ]).then(function (parts) {
        var apiProg = parts[0];
        var fileProg = parts[1];
        var indRes = parts[2];
        var linksRes = parts[3];
        var knowledgeRes = parts[4];
        var tasksRes = parts[5];

        var programs = [];
        var programsSource = "";
        var planGoals = [];
        if (apiProg.ok && apiProg.data) {
          programs = apiProg.data.programs || [];
          planGoals = apiProg.data.plan_goals || [];
          programsSource = "api:/api/programs";
        } else if (fileProg.ok && fileProg.data) {
          programs = fileProg.data.programs || fileProg.data || [];
          programsSource = "file:" + programsUrl;
        }

        var indicators = [];
        if (indRes.ok && indRes.data) {
          indicators = indRes.data.indicators || indRes.data || [];
        }

        var goalLinksDoc = null;
        var linksSource = "";
        if (linksRes.ok && linksRes.data) {
          goalLinksDoc = linksRes.data;
          linksSource = "file:" + linksUrl;
        }

        var tasks = [];
        var tasksSource = "";
        if (tasksRes.ok && tasksRes.data) {
          tasks = tasksRes.data.tasks || tasksRes.data || [];
          if (tasks.length) tasksSource = "api:/api/operational-plan/tasks";
        }
        /* API قد يعيد ok مع tasks=[] — لا يُحجب احتياط الروابط/العناوين */
        if (!tasks.length && goalLinksDoc && goalLinksDoc.links) {
          tasks = goalLinksDoc.links.filter(function (row) {
            return plain(row.role) === roleId;
          });
          tasksSource = "file:task_goal_links.json";
        }

        var knowledgeItems = [];
        var knowledgeSource = "";
        if (knowledgeRes.ok && knowledgeRes.data) {
          knowledgeItems = knowledgeRes.data.items || [];
          knowledgeSource = "file:" + knowledgeUrl;
        }

        return {
          rolesDoc: rolesDoc,
          role: role,
          programs: programs,
          programsSource: programsSource,
          planGoals: planGoals,
          indicators: indicators,
          tasks: tasks,
          tasksSource: tasksSource,
          goalLinksDoc: goalLinksDoc,
          linksSource: linksSource,
          knowledgeItems: knowledgeItems,
          knowledgeSource: knowledgeSource
        };
      });
    });
  }

  function loadPack(roleId, opts) {
    opts = opts || {};
    opts.roleId = roleId;
    return loadSources(opts).then(function (sources) {
      return buildPack(roleId, sources);
    });
  }

  function listRoles(opts) {
    var rolesUrl = (opts && opts.rolesUrl) || "roles.json";
    return fetchJson(rolesUrl).then(function (doc) {
      return (doc.roles || []).map(function (r) {
        return { id: plain(r.id), label_ar: plain(r.label_ar) };
      });
    });
  }

  global.RolePlanPack = {
    buildPack: buildPack,
    loadPack: loadPack,
    loadSources: loadSources,
    listRoles: listRoles,
    roleOwnsProgram: roleOwnsProgram
  };
})(typeof window !== "undefined" ? window : globalThis);
