const state = {
  context: null,
  entries: [],
  visible: [],
  editing: null,
  overdueOnly: false
};

const preferredFields = [
  "file_", "phase", "policyholder", "peril", "task", "subtasks", "due_date",
  "waiting_for", "workflow", "carrier", "created", "age", "date_of_loss",
  "loss_address", "note"
];

const byId = id => document.getElementById(id);
const text = value => String(value == null ? "" : value);
const normalized = value => text(value).trim().toLowerCase();

function fieldFor(label, fallback) {
  const target = normalized(label).replace(/[^a-z0-9]/g, "");
  return state.context.fields.find(field =>
    normalized(field.label).replace(/[^a-z0-9]/g, "") === target
  ) || state.context.fields.find(field => field.key === fallback);
}

function valueFor(entry, label, fallback) {
  const field = fieldFor(label, fallback);
  return field ? entry.data?.[field.key] ?? "" : "";
}

function escapeText(value) {
  const node = document.createElement("div");
  node.textContent = text(value);
  return node.innerHTML;
}

function dateFrom(value) {
  if (!value) return null;
  const date = new Date(text(value).length === 10 ? value + "T12:00:00" : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function overdue(entry) {
  const due = dateFrom(valueFor(entry, "Due Date", "due_date"));
  return due ? startOfDay(due) < startOfDay(new Date()) : false;
}

function dueSoon(entry, days) {
  const due = dateFrom(valueFor(entry, "Due Date", "due_date"));
  if (!due) return false;
  const difference = startOfDay(due) - startOfDay(new Date());
  return difference >= 0 && difference <= days * 86400000;
}

function formatDate(value) {
  const date = dateFrom(value);
  if (!date) return text(value) || "No date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function unique(label, fallback) {
  return [...new Set(
    state.entries.map(entry => text(valueFor(entry, label, fallback)).trim()).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));
}

function setOptions(id, values, firstLabel) {
  const select = byId(id);
  const current = select.value;
  select.innerHTML = '<option value="">' + escapeText(firstLabel) + "</option>" +
    values.map(value => '<option value="' + escapeText(value) + '">' + escapeText(value) + "</option>").join("");
  if (values.includes(current)) select.value = current;
}

function applyFilters() {
  const query = normalized(byId("search-input").value);
  const phase = byId("phase-filter").value;
  const workflow = byId("workflow-filter").value;

  state.visible = state.entries.filter(entry => {
    if (phase && text(valueFor(entry, "Phase", "phase")) !== phase) return false;
    if (workflow && text(valueFor(entry, "Workflow", "workflow")) !== workflow) return false;
    if (state.overdueOnly && !overdue(entry)) return false;
    if (!query) return true;
    return [
      entry.title,
      valueFor(entry, "File #", "file_"),
      valueFor(entry, "Policyholder", "policyholder"),
      valueFor(entry, "Task", "task"),
      valueFor(entry, "Carrier", "carrier"),
      valueFor(entry, "Loss Address", "loss_address"),
      valueFor(entry, "Note", "note")
    ].map(normalized).join(" ").includes(query);
  });

  state.visible.sort((a, b) => {
    const aDate = dateFrom(valueFor(a, "Due Date", "due_date"));
    const bDate = dateFrom(valueFor(b, "Due Date", "due_date"));
    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;
    return aDate - bDate;
  });
  render();
}

function render() {
  byId("total-count").textContent = state.visible.length;
  byId("overdue-count").textContent = state.visible.filter(overdue).length;
  byId("week-count").textContent = state.visible.filter(entry => dueSoon(entry, 7)).length;
  byId("claim-count").textContent = new Set(
    state.visible.map(entry => text(valueFor(entry, "File #", "file_"))).filter(Boolean)
  ).size;
  byId("result-label").textContent = state.visible.length + " of " + state.entries.length;

  if (!state.visible.length) {
    byId("queue-content").replaceChildren(byId("empty-template").content.cloneNode(true));
    return;
  }

  const rows = state.visible.map(entry => {
    const workflow = text(valueFor(entry, "Workflow", "workflow"));
    const isOverdue = overdue(entry);
    return '<tr data-entry="' + escapeText(entry.id) + '" tabindex="0">' +
      '<td><span class="file-number">' + escapeText(valueFor(entry, "File #", "file_") || "No file") + '</span></td>' +
      '<td><div class="main-value">' + escapeText(valueFor(entry, "Policyholder", "policyholder") || entry.title) + '</div>' +
      '<div class="sub-value">' + escapeText(valueFor(entry, "Phase", "phase")) + '</div></td>' +
      '<td class="task"><div class="main-value">' + escapeText(valueFor(entry, "Task", "task") || entry.title) + '</div>' +
      '<div class="sub-value">' + escapeText(valueFor(entry, "Waiting For", "waiting_for")) + '</div></td>' +
      '<td><span class="tag ' + (normalized(workflow) === "new claim" ? "new" : "supplemental") + '">' +
      escapeText(workflow || "Unassigned") + '</span></td>' +
      '<td>' + escapeText(valueFor(entry, "Carrier", "carrier") || "Not listed") + '</td>' +
      '<td class="due ' + (isOverdue ? "overdue" : "") + '">' +
      (isOverdue ? "OVERDUE · " : "") + escapeText(formatDate(valueFor(entry, "Due Date", "due_date"))) + '</td></tr>';
  }).join("");

  const cards = state.visible.map(entry => {
    const isOverdue = overdue(entry);
    return '<article class="claim-card" data-entry="' + escapeText(entry.id) + '" tabindex="0">' +
      '<div><span class="file-number">' + escapeText(valueFor(entry, "File #", "file_") || "No file") + '</span>' +
      '<span class="due ' + (isOverdue ? "overdue" : "") + '">' +
      (isOverdue ? "OVERDUE · " : "") + escapeText(formatDate(valueFor(entry, "Due Date", "due_date"))) + '</span></div>' +
      '<h3>' + escapeText(valueFor(entry, "Task", "task") || entry.title) + '</h3>' +
      '<p><strong>' + escapeText(valueFor(entry, "Policyholder", "policyholder")) + '</strong><br>' +
      escapeText(valueFor(entry, "Phase", "phase")) + ' · ' + escapeText(valueFor(entry, "Workflow", "workflow")) + '<br>' +
      escapeText(valueFor(entry, "Carrier", "carrier")) + '</p></article>';
  }).join("");

  byId("queue-content").innerHTML =
    '<div class="table-scroll"><table><thead><tr><th>File</th><th>Policyholder / phase</th>' +
    '<th>Task / waiting for</th><th>Workflow</th><th>Carrier</th><th>Due</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '<div class="mobile-cards">' + cards + '</div>';

  document.querySelectorAll("[data-entry]").forEach(node => {
    node.addEventListener("click", () => openEditor(node.dataset.entry));
    node.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") openEditor(node.dataset.entry);
    });
  });
}

function orderedFields() {
  return [...state.context.fields].sort((a, b) => {
    const aIndex = preferredFields.indexOf(a.key);
    const bIndex = preferredFields.indexOf(b.key);
    return (aIndex < 0 ? 999 : aIndex) - (bIndex < 0 ? 999 : bIndex);
  });
}

function controlFor(field, current) {
  const id = "field-" + field.key;
  const required = field.required ? " required" : "";
  if (field.type === "long_text" || normalized(field.label) === "note") {
    return '<textarea id="' + id + '" data-field="' + escapeText(field.key) + '"' + required + '>' +
      escapeText(current) + '</textarea>';
  }
  if (field.type === "dropdown") {
    return '<select id="' + id + '" data-field="' + escapeText(field.key) + '"' + required + '>' +
      '<option value="">Select</option>' + (field.options || []).map(option =>
        '<option value="' + escapeText(option) + '"' + (text(option) === text(current) ? " selected" : "") + '>' +
        escapeText(option) + '</option>'
      ).join("") + '</select>';
  }
  if (field.type === "boolean") {
    return '<select id="' + id + '" data-field="' + escapeText(field.key) + '">' +
      '<option value="">Not set</option><option value="true"' + (current === true ? " selected" : "") + '>Yes</option>' +
      '<option value="false"' + (current === false ? " selected" : "") + '>No</option></select>';
  }
  const inputType = field.type === "date" ? "date" :
    ["number", "currency", "rating"].includes(field.type) ? "number" : "text";
  const step = field.type === "currency" ? ' step="0.01"' : "";
  return '<input id="' + id + '" data-field="' + escapeText(field.key) + '" type="' + inputType + '"' +
    step + ' value="' + escapeText(current) + '"' + required + '>';
}

function openEditor(id) {
  state.editing = id ? state.entries.find(entry => entry.id === id) : null;
  byId("drawer-title").textContent = state.editing ? "Edit action item" : "New action item";
  byId("drawer-file").textContent = state.editing
    ? text(valueFor(state.editing, "File #", "file_") || "ACTION ITEM")
    : "NEW ITEM";
  byId("delete-button").style.visibility = state.editing ? "visible" : "hidden";
  byId("form-error").textContent = "";
  const values = state.editing?.data || {};
  byId("form-grid").innerHTML = orderedFields().map(field => {
    const wide = field.type === "long_text" ||
      ["task", "carrier", "loss address", "note"].includes(normalized(field.label));
    return '<div class="form-field ' + (wide ? "wide" : "") + '">' +
      '<label for="field-' + escapeText(field.key) + '">' + escapeText(field.label) +
      (field.required ? " *" : "") + '</label>' + controlFor(field, values[field.key]) + '</div>';
  }).join("");
  byId("scrim").hidden = false;
  document.body.style.overflow = "hidden";
}

function closeEditor() {
  byId("scrim").hidden = true;
  document.body.style.overflow = "";
  state.editing = null;
}

function formValues() {
  const values = {};
  orderedFields().forEach(field => {
    const input = byId("field-" + field.key);
    if (!input) return;
    let value = input.value.trim();
    if (field.type === "boolean") value = value === "" ? null : value === "true";
    else if (["number", "currency", "rating"].includes(field.type)) value = value === "" ? null : Number(value);
    else value = value || null;
    values[field.key] = value;
  });
  return values;
}

async function saveEntry(event) {
  event.preventDefault();
  const button = byId("save-button");
  button.disabled = true;
  button.textContent = "Saving";
  byId("form-error").textContent = "";
  try {
    if (state.editing) await CrewLog.updateEntry(state.editing.id, formValues());
    else await CrewLog.createEntry(formValues());
    closeEditor();
    await load();
  } catch (error) {
    byId("form-error").textContent = error.message || "The action item could not be saved.";
  } finally {
    button.disabled = false;
    button.textContent = "Save action";
  }
}

async function deleteEntry() {
  if (!state.editing || !confirm("Delete this action item?")) return;
  const button = byId("delete-button");
  button.disabled = true;
  try {
    await CrewLog.deleteEntry(state.editing.id);
    closeEditor();
    await load();
  } catch (error) {
    byId("form-error").textContent = error.message || "The action item could not be deleted.";
  } finally {
    button.disabled = false;
  }
}

async function load() {
  byId("result-label").textContent = "Loading";
  try {
    const [context, entries] = await Promise.all([
      CrewLog.getContext(),
      CrewLog.listEntries()
    ]);
    state.context = context;
    state.entries = entries;
    byId("company-name").textContent = context.tenant.name || "Beyond Adjusting";
    byId("viewer").textContent = (context.viewer.name || "Crew member") + " · " + context.viewer.role;
    setOptions("phase-filter", unique("Phase", "phase"), "All phases");
    setOptions("workflow-filter", unique("Workflow", "workflow"), "All workflows");
    applyFilters();
  } catch (error) {
    byId("result-label").textContent = "Error";
    byId("queue-content").innerHTML =
      '<div class="error-state"><strong>Claim work could not load.</strong><p>' +
      escapeText(error.message || "Refresh and try again.") + '</p></div>';
  }
}

byId("search-input").addEventListener("input", applyFilters);
byId("phase-filter").addEventListener("change", applyFilters);
byId("workflow-filter").addEventListener("change", applyFilters);
byId("overdue-button").addEventListener("click", () => {
  state.overdueOnly = !state.overdueOnly;
  byId("overdue-button").setAttribute("aria-pressed", text(state.overdueOnly));
  applyFilters();
});
byId("refresh-button").addEventListener("click", load);
byId("new-button").addEventListener("click", () => openEditor(null));
byId("close-button").addEventListener("click", closeEditor);
byId("cancel-button").addEventListener("click", closeEditor);
byId("delete-button").addEventListener("click", deleteEntry);
byId("entry-form").addEventListener("submit", saveEntry);
byId("scrim").addEventListener("click", event => {
  if (event.target === byId("scrim")) closeEditor();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !byId("scrim").hidden) closeEditor();
});
window.addEventListener("crewlog:ready", load);
